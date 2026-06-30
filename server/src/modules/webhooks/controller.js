const { Op } = require('sequelize');
const { Organization, Workspace, Lead, LeadActivity, User, WebhookRoute } = require('../../config/models');
const { calculateLeadScore, isHotLead } = require('../../utils/helpers');
const notificationService = require('../../services/notificationService');
const emailService = require('../../services/emailService');
const { emitToWorkspace } = require('../../sockets');
const { logUsage } = require('../../middleware/entitlement');

// Resolve org+workspace from token — workspace token takes priority over org token
const resolveTarget = async (token) => {
  const ws = await Workspace.findOne({
    where: { webhookToken: token, isActive: true },
    include: [{ model: Organization, as: 'organization', where: { isActive: true } }],
  });
  if (ws) return { org: ws.organization, workspace: ws };

  const org = await Organization.findOne({ where: { webhookToken: token, isActive: true } });
  if (org) return { org, workspace: null };

  return null;
};

// When using org-level token, route by page_id → form_id → default workspace
const resolveWorkspace = async (org, leadData) => {
  const pageId = leadData.metadata?.meta_page_id;
  const formId = leadData.metadata?.meta_form_id;

  if (pageId) {
    const route = await WebhookRoute.findOne({
      where: { organizationId: org.id, matchType: 'page_id', matchValue: pageId, isActive: true },
    });
    if (route) {
      const ws = await Workspace.findOne({ where: { id: route.workspaceId, isActive: true } });
      if (ws) return ws;
    }
  }

  if (formId) {
    const route = await WebhookRoute.findOne({
      where: { organizationId: org.id, matchType: 'form_id', matchValue: formId, isActive: true },
    });
    if (route) {
      const ws = await Workspace.findOne({ where: { id: route.workspaceId, isActive: true } });
      if (ws) return ws;
    }
  }

  return Workspace.findOne({ where: { organizationId: org.id, isActive: true }, order: [['createdAt', 'ASC']] });
};

const findLeastLoadedAgent = async (workspaceId, organizationId) => {
  const agents = await User.findAll({
    where: { workspaceId, organizationId, role: { [Op.in]: ['employee', 'admin'] }, isActive: true },
    attributes: ['id'],
  });
  if (!agents.length) return null;
  const counts = await Promise.all(agents.map(async (a) => ({
    id: a.id,
    count: await Lead.count({ where: { assignedTo: a.id, status: { [Op.notIn]: ['Won', 'Lost'] } } }),
  })));
  counts.sort((a, b) => a.count - b.count);
  return counts[0]?.id || null;
};

const processLead = async (leadData, org, workspace, source) => {
  if (!workspace) throw new Error('No active workspace found for organization');

  const currentCount = await Lead.count({ where: { organizationId: org.id } });
  if (currentCount >= org.maxLeadsTotal) {
    return { success: false, limitReached: true, message: 'Lead limit reached' };
  }

  if (leadData.phone) {
    const dup = await Lead.findOne({ where: { phone: leadData.phone, organizationId: org.id } });
    if (dup) {
      await dup.increment('repeatCount');
      await dup.update({ isDuplicate: true, metadata: { ...dup.metadata, ...leadData.metadata } });
      await LeadActivity.create({
        leadId: dup.id, organizationId: org.id, workspaceId: dup.workspaceId,
        userId: null, type: 'duplicate_detected',
        description: `Duplicate ${source} webhook received`, metadata: leadData.metadata || {},
      });
      return { success: true, isDuplicate: true, lead: dup };
    }
  }

  const assignedTo = await findLeastLoadedAgent(workspace.id, org.id);
  const newLead = {
    organizationId: org.id, workspaceId: workspace.id,
    name: leadData.name || 'Unknown Lead', phone: leadData.phone, email: leadData.email,
    source, campaign: leadData.campaign, city: leadData.city || null, priority: 'Warm', status: 'New',
    assignedTo, metadata: leadData.metadata || {},
  };
  newLead.score = calculateLeadScore(newLead);
  newLead.isHot = isHotLead(newLead);

  const lead = await Lead.create(newLead);
  await LeadActivity.create({
    leadId: lead.id, organizationId: org.id, workspaceId: workspace.id,
    userId: null, type: 'webhook_received',
    description: `Lead received via ${source} webhook`, metadata: leadData.metadata || {},
  });

  if (assignedTo) {
    const assignedUser = await User.findByPk(assignedTo, { attributes: ['id', 'name'] });
    if (assignedUser) await notificationService.notifyLeadAssigned({ lead, assignedUser, organizationId: org.id, workspaceId: workspace.id });
  }

  emitToWorkspace(workspace.id, 'new_lead', { leadId: lead.id, name: lead.name, source, phone: lead.phone });

  if (lead.email && org.settings) {
    emailService.sendLeadAcknowledgement(lead, org.settings, org.settings?.smtpConfig).catch(console.error);
  }

  await logUsage(org.id, workspace.id, 'webhook_received');
  return { success: true, isDuplicate: false, lead };
};

const extractNameFromFields = (fieldList) => {
  let firstName = '', lastName = '', fullName = '';
  fieldList.forEach(({ field_name, values }) => {
    const val = (values?.[0] || '').trim();
    if (!field_name || !val) return;
    if (/^full_name$/i.test(field_name) || /^name$/i.test(field_name)) {
      fullName = fullName || val;
    } else if (/^first_name$/i.test(field_name)) {
      firstName = val;
    } else if (/^last_name$/i.test(field_name)) {
      lastName = val;
    } else if (/name/i.test(field_name)) {
      fullName = fullName || val;
    }
  });
  return fullName || `${firstName} ${lastName}`.trim() || '';
};

const parseMeta = (body) => {
  const data = { metadata: {} };
  if (body.entry) {
    try {
      const entry = body.entry[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const leadgenId = value?.leadgen_id;
      const pageId = value?.page_id;
      const formId = value?.form_id;
      const adId = value?.ad_id;
      const fieldData = value?.field_data || [];
      const nameVal = extractNameFromFields(fieldData);
      if (nameVal) data.name = nameVal;
      fieldData.forEach(({ field_name, values }) => {
        const val = values?.[0] || '';
        if (/^full_name$|^first_name$|^last_name$|^name$/i.test(field_name)) return;
        if (/name/i.test(field_name)) return;
        if (/phone|mobile|contact/i.test(field_name)) data.phone = val;
        else if (/email/i.test(field_name)) data.email = val;
        else if (/^city$/i.test(field_name)) data.city = val;
        else if (/address|location/i.test(field_name)) data.clientAddress = val;
        else data.metadata[field_name] = val;
      });
      if (leadgenId) data.metadata.meta_leadgen_id = leadgenId;
      if (pageId) data.metadata.meta_page_id = pageId;
      if (formId) { data.metadata.meta_form_id = formId; data.campaign = `FB Form - ${formId}`; }
      if (adId) data.metadata.meta_ad_id = adId;
    } catch {}
  } else if (body.field_data) {
    const nameVal = extractNameFromFields(body.field_data);
    if (nameVal) data.name = nameVal;
    body.field_data.forEach(({ field_name, values }) => {
      const val = values?.[0] || '';
      if (/^full_name$|^first_name$|^last_name$|^name$/i.test(field_name)) return;
      if (/name/i.test(field_name)) return;
      if (/phone|mobile/i.test(field_name)) data.phone = val;
      else if (/email/i.test(field_name)) data.email = val;
      else data.metadata[field_name] = val;
    });
  } else {
    data.name = body.name || body.full_name;
    data.phone = body.phone || body.mobile;
    data.email = body.email;
    data.campaign = body.campaign;
    Object.keys(body).forEach((k) => {
      if (!['name', 'full_name', 'phone', 'mobile', 'email', 'campaign'].includes(k)) data.metadata[k] = body[k];
    });
  }
  return data;
};

const metaWebhookGet = async (req, res) => {
  const mode = req.query['hub.mode'];
  const verifyToken = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const target = await resolveTarget(req.params.token);
  if (!target) return res.status(404).send('Not Found');
  const expectedToken = target.workspace?.webhookToken || target.org.webhookToken;
  if (mode === 'subscribe' && verifyToken === expectedToken) return res.send(challenge);
  res.status(403).send('Forbidden');
};

const metaWebhookPost = async (req, res) => {
  try {
    const target = await resolveTarget(req.params.token);
    if (!target) return res.status(404).json({ error: 'Not found' });
    if (!target.org.canUseWebhooks) return res.status(403).json({ error: 'Webhooks not enabled' });
    const leadData = parseMeta(req.body);
    const workspace = target.workspace || await resolveWorkspace(target.org, leadData);
    const result = await processLead(leadData, target.org, workspace, 'Meta Ads');
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Meta webhook error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

// Google Ads Lead Form Extensions send a signed GET for verification before posting
const googleWebhookGet = async (req, res) => {
  // Google sends ?google_key=<token> for verification — respond with the key to confirm
  const googleKey = req.query.google_key;
  if (googleKey) return res.send(googleKey);
  res.status(200).send('OK');
};

const parseGoogle = (body) => {
  // Google Ads Lead Form Extension payload format
  const data = { metadata: {} };
  // Direct field mapping from Google's schema
  const fullName = body.user_column_data
    ? body.user_column_data.find(c => c.column_id === 'FULL_NAME')?.string_value
    : null;
  const firstName = body.user_column_data
    ? body.user_column_data.find(c => c.column_id === 'GIVEN_NAME')?.string_value
    : null;
  const lastName = body.user_column_data
    ? body.user_column_data.find(c => c.column_id === 'FAMILY_NAME')?.string_value
    : null;
  const phone = body.user_column_data
    ? body.user_column_data.find(c => c.column_id === 'PHONE_NUMBER')?.string_value
    : null;
  const email = body.user_column_data
    ? body.user_column_data.find(c => c.column_id === 'EMAIL')?.string_value
    : null;
  const city = body.user_column_data
    ? body.user_column_data.find(c => c.column_id === 'CITY')?.string_value
    : null;

  if (body.user_column_data) {
    // Structured Google Ads format
    data.name = fullName || [firstName, lastName].filter(Boolean).join(' ') || 'Google Ads Lead';
    data.phone = phone || body.phone_number;
    data.email = email || body.email;
    if (city) data.city = city;
    data.campaign = body.campaign_name || body.ad_group_name || body.lead_form_name;
    data.metadata = {
      google_gclid: body.gclid,
      google_campaign: body.campaign_name,
      google_adgroup: body.ad_group_name,
      google_form: body.lead_form_name,
      google_adid: body.ad_id,
    };
    // Store all custom question answers
    if (body.user_column_data) {
      body.user_column_data.forEach(col => {
        if (!['FULL_NAME','GIVEN_NAME','FAMILY_NAME','PHONE_NUMBER','EMAIL','CITY'].includes(col.column_id)) {
          data.metadata[col.column_id.toLowerCase()] = col.string_value;
        }
      });
    }
  } else {
    // Flat / Zapier-style format fallback
    data.name = body.full_name || body.name || `${body.firstName || body.first_name || ''} ${body.lastName || body.last_name || ''}`.trim() || 'Google Ads Lead';
    data.phone = body.phone_number || body.phone;
    data.email = body.email;
    data.campaign = body.campaign_name || body.campaign || body.ad_group_name;
    data.metadata = { ...body };
  }

  return data;
};

const googleWebhookPost = async (req, res) => {
  try {
    const target = await resolveTarget(req.params.token);
    if (!target) return res.status(404).json({ error: 'Not found' });
    if (!target.org.canUseWebhooks) return res.status(403).json({ error: 'Webhooks not enabled' });
    const leadData = parseGoogle(req.body);
    const workspace = target.workspace || await resolveWorkspace(target.org, leadData);
    const result = await processLead(leadData, target.org, workspace, 'Google Ads');
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Google webhook error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

const websiteWebhookPost = async (req, res) => {
  try {
    const target = await resolveTarget(req.params.token);
    if (!target) return res.status(404).json({ error: 'Not found' });
    if (!target.org.canUseWebhooks) return res.status(403).json({ error: 'Webhooks not enabled' });
    const body = req.body;
    const leadData = {
      name: body.name || body.fullName,
      phone: body.phone || body.mobile,
      email: body.email,
      city: body.city || null,
      campaign: body.source || body.page || body.campaign,
      metadata: body,
    };
    const workspace = target.workspace || await resolveWorkspace(target.org, leadData);
    const result = await processLead(leadData, target.org, workspace, 'Website');
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Website webhook error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

const whatsappWebhookGet = async (req, res) => {
  const mode = req.query['hub.mode'];
  const verifyToken = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const target = await resolveTarget(req.params.token);
  if (!target) return res.status(404).send('Not Found');
  const expectedToken = target.workspace?.webhookToken || target.org.webhookToken;
  if (mode === 'subscribe' && verifyToken === expectedToken) return res.send(challenge);
  res.status(403).send('Forbidden');
};

const whatsappWebhookPost = async (req, res) => {
  try {
    const target = await resolveTarget(req.params.token);
    if (!target) return res.status(404).json({ error: 'Not found' });
    if (!target.org.canUseWebhooks) return res.status(403).json({ error: 'Webhooks not enabled' });
    const messages = req.body?.entry?.[0]?.changes?.[0]?.value?.messages || [];
    for (const msg of messages) {
      if (msg.type !== 'text') continue;
      const phone = msg.from;
      const text = msg.text?.body || '';
      const existing = await Lead.findOne({ where: { phone, organizationId: target.org.id } });
      if (!existing) {
        const leadData = { name: `WhatsApp: ${phone}`, phone, metadata: { waMessageId: msg.id, initialMessage: text } };
        const workspace = target.workspace || await resolveWorkspace(target.org, leadData);
        await processLead(leadData, target.org, workspace, 'WhatsApp');
      }
    }
    res.json({ success: true });
  } catch (err) {
    console.error('WhatsApp webhook error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

const instagramWebhookPost = async (req, res) => {
  try {
    const target = await resolveTarget(req.params.token);
    if (!target) return res.status(404).json({ error: 'Not found' });
    if (!target.org.canUseWebhooks) return res.status(403).json({ error: 'Webhooks not enabled' });
    const body = req.body;
    const leadData = {
      name: body.name || body.username || 'Instagram DM',
      phone: body.phone,
      email: body.email,
      metadata: body,
    };
    const workspace = target.workspace || await resolveWorkspace(target.org, leadData);
    const result = await processLead(leadData, target.org, workspace, 'Instagram DM');
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Instagram webhook error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

module.exports = {
  metaWebhookGet, metaWebhookPost,
  googleWebhookGet, googleWebhookPost,
  websiteWebhookPost,
  whatsappWebhookGet, whatsappWebhookPost,
  instagramWebhookPost,
};
