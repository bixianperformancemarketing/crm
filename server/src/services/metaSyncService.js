const axios = require('axios');
const { Op } = require('sequelize');
const { MetaIntegration, Lead, LeadActivity, sequelize } = require('../config/models');

const META_BASE = 'https://graph.facebook.com/v19.0';

const extractLeadFields = (fieldData) => {
  const fields = {};
  for (const f of fieldData || []) {
    if (f.name) fields[f.name.toLowerCase()] = f.values?.[0] || '';
  }
  const firstName = fields['first_name'] || '';
  const lastName = fields['last_name'] || '';
  let fullName = fields['full_name'] || fields['name'] || `${firstName} ${lastName}`.trim();
  if (!fullName) {
    const nameEntry = Object.entries(fields).find(([k, v]) => /name/i.test(k) && v);
    if (nameEntry) fullName = nameEntry[1];
  }
  return {
    name: fullName || 'Unknown',
    phone: fields['phone_number'] || fields['phone'] || fields['mobile'] || fields['mobile_number'] || '',
    email: fields['email'] || '',
    raw: fields,
  };
};

const resolveWorkspaceForForm = (integration, formId) => {
  const routes = integration.formRoutes || [];
  const match = routes.find(r => r.formId === formId);
  return match ? match.workspaceId : integration.workspaceId;
};

const processMetaLead = async (metaLead, form, integration) => {
  const existingRows = await sequelize.query(
    `SELECT id FROM leads WHERE organizationId = :orgId AND metadata IS NOT NULL AND JSON_VALID(metadata) = 1 AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.metaLeadId')) = :metaLeadId LIMIT 1`,
    { replacements: { orgId: integration.organizationId, metaLeadId: String(metaLead.id) }, type: 'SELECT' }
  );
  if (existingRows && existingRows.length > 0) return false;

  const { name, phone, email, raw } = extractLeadFields(metaLead.field_data);
  const workspaceId = resolveWorkspaceForForm(integration, form.id);

  const lead = await Lead.create({
    organizationId: integration.organizationId,
    workspaceId,
    name,
    phone,
    email,
    source: 'Meta Ads',
    campaign: form.name || 'Meta Lead Form',
    status: 'New',
    metadata: {
      metaLeadId: metaLead.id,
      metaFormId: form.id,
      metaFormName: form.name,
      metaPageId: integration.fbPageId,
      rawFields: raw,
      createdTime: metaLead.created_time,
    },
  });

  await LeadActivity.create({
    leadId: lead.id,
    organizationId: integration.organizationId,
    workspaceId,
    type: 'created',
    description: `Imported from Meta Ads form: ${form.name}`,
  });

  return true;
};

const syncOneIntegration = async (integration) => {
  await integration.update({ syncStatus: 'syncing' });

  // Subtract 5-min overlap from lastSyncAt so leads at the boundary are never missed;
  // metaLeadId dedup prevents duplicates from the overlap window
  const since = integration.lastSyncAt
    ? Math.floor((new Date(integration.lastSyncAt).getTime() - 5 * 60 * 1000) / 1000)
    : Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);

  try {
    const formsRes = await axios.get(`${META_BASE}/${integration.fbPageId}/leadgen_forms`, {
      params: {
        access_token: integration.accessToken,
        fields: 'id,name,status',
        limit: 100,
      },
      timeout: 20000,
    });

    const forms = formsRes.data?.data || [];
    let newCount = 0;

    for (const form of forms) {
      let url = `${META_BASE}/${form.id}/leads`;
      let params = {
        access_token: integration.accessToken,
        fields: 'id,created_time,field_data',
        filtering: JSON.stringify([{ field: 'time_created', operator: 'GREATER_THAN', value: since }]),
        limit: 100,
      };

      while (url) {
        const leadsRes = await axios.get(url, { params, timeout: 20000 });
        const metaLeads = leadsRes.data?.data || [];

        for (const metaLead of metaLeads) {
          const created = await processMetaLead(metaLead, form, integration);
          if (created) newCount++;
        }

        url = leadsRes.data?.paging?.next || null;
        params = {};
      }
    }

    await integration.update({ lastSyncAt: new Date(), syncStatus: 'idle', lastSyncError: null });
    return newCount;
  } catch (err) {
    const message = err.response?.data?.error?.message || err.message;
    await integration.update({ syncStatus: 'error', lastSyncError: message });
    throw new Error(message);
  }
};

const syncAllIntegrations = async () => {
  try {
    const integrations = await MetaIntegration.findAll({
      where: { isActive: true, syncStatus: { [Op.ne]: 'syncing' } },
    });

    if (integrations.length === 0) {
      console.log('[MetaSync] No active integrations to sync');
      return;
    }

    console.log(`[MetaSync] Starting sync for ${integrations.length} integration(s)`);
    let total = 0;
    for (const integration of integrations) {
      try {
        console.log(`[MetaSync] Syncing page ${integration.fbPageId} (lastSyncAt: ${integration.lastSyncAt || 'never'})`);
        const count = await syncOneIntegration(integration);
        console.log(`[MetaSync] Page ${integration.fbPageId}: ${count} new lead(s)`);
        total += count;
      } catch (err) {
        console.error(`[MetaSync] Error syncing page ${integration.fbPageId}:`, err.message);
      }
    }

    console.log(`[MetaSync] Sync complete. Total new leads: ${total}`);
  } catch (err) {
    console.error('[MetaSync] Fatal error:', err.message);
  }
};

const backfillMetaLeadNames = async (organizationId) => {
  const { Lead } = require('../config/models');
  const leads = await Lead.findAll({
    where: { organizationId, source: 'Meta Ads', name: 'Unknown' },
  });

  let updated = 0;
  for (const lead of leads) {
    const rawFields = lead.metadata?.rawFields || {};
    // rawFields is stored as {fieldName: value} — search case-insensitively
    const lower = {};
    for (const [k, v] of Object.entries(rawFields)) {
      lower[k.toLowerCase()] = v;
    }
    let name = lower['full_name'] || lower['name'] || '';
    if (!name) {
      const first = lower['first_name'] || '';
      const last = lower['last_name'] || '';
      name = `${first} ${last}`.trim();
    }
    if (!name) {
      const entry = Object.entries(lower).find(([k, v]) => /name/i.test(k) && v);
      if (entry) name = entry[1];
    }
    if (name) {
      await lead.update({ name });
      updated++;
    }
  }

  return { total: leads.length, updated };
};

module.exports = { syncOneIntegration, syncAllIntegrations, backfillMetaLeadNames };
