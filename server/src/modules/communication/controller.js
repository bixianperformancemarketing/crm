const { CallLog, WhatsappLog, EmailLog, Lead, LeadActivity, Organization } = require('../../config/models');
const emailService = require('../../services/emailService');

const logCall = async (req, res) => {
  try {
    const { user, workspaceId } = req;
    const { leadId, duration, note, outcome, callType = 'outbound', callStatus = 'Answered', nextFollowup } = req.body;
    if (!leadId) return res.status(400).json({ success: false, message: 'Lead ID required' });

    const lead = await Lead.findOne({ where: { id: leadId, organizationId: user.organizationId, workspaceId } });
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    const callLog = await CallLog.create({
      leadId, organizationId: user.organizationId, workspaceId,
      userId: user.id, duration: parseInt(duration) || 0,
      note: note || '', outcome: outcome || '', callType, status: callStatus,
    });

    const mins = Math.floor((parseInt(duration) || 0) / 60);
    const secs = (parseInt(duration) || 0) % 60;
    await LeadActivity.create({
      leadId, organizationId: user.organizationId, workspaceId, userId: user.id,
      type: 'call_logged',
      description: `${callType === 'inbound' ? 'Inbound' : 'Outbound'} call logged (${mins}m ${secs}s) — ${callStatus}. ${outcome || ''}`,
      metadata: { callLogId: callLog.id, duration, outcome, callStatus },
    });

    await Lead.update({ lastCallStatus: callStatus, ...(note ? { lastCallNote: note } : {}) }, { where: { id: leadId } });
    if (nextFollowup) {
      const { Followup } = require('../../config/models');
      await Followup.create({ leadId, organizationId: user.organizationId, workspaceId, userId: user.id, scheduledAt: nextFollowup, note: `Post-call followup`, status: 'pending' });
      await Lead.update({ nextFollowup }, { where: { id: leadId } });
    }

    res.status(201).json({ success: true, message: 'Call logged', callLog });
  } catch (err) {
    console.error('logCall error:', err);
    res.status(500).json({ success: false, message: 'Failed to log call' });
  }
};

const logWhatsApp = async (req, res) => {
  try {
    const { user, workspaceId } = req;
    const { leadId, message, direction = 'outbound' } = req.body;
    if (!leadId || !message) return res.status(400).json({ success: false, message: 'Lead ID and message required' });

    const lead = await Lead.findOne({ where: { id: leadId, organizationId: user.organizationId, workspaceId } });
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    const log = await WhatsappLog.create({
      leadId, organizationId: user.organizationId, workspaceId, userId: user.id, message, direction,
    });
    await LeadActivity.create({
      leadId, organizationId: user.organizationId, workspaceId, userId: user.id,
      type: 'whatsapp_sent',
      description: `WhatsApp ${direction} message logged`,
      metadata: { whatsappLogId: log.id, preview: message.substring(0, 100) },
    });

    res.status(201).json({ success: true, message: 'WhatsApp log saved', log });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to log WhatsApp message' });
  }
};

const sendEmail = async (req, res) => {
  try {
    const { user, workspaceId } = req;
    const { leadId, subject, body } = req.body;
    if (!leadId || !subject || !body) return res.status(400).json({ success: false, message: 'Lead ID, subject, and body required' });

    const lead = await Lead.findOne({ where: { id: leadId, organizationId: user.organizationId, workspaceId } });
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
    if (!lead.email) return res.status(400).json({ success: false, message: 'Lead has no email address' });

    const org = await Organization.findByPk(user.organizationId, { attributes: ['settings'] });
    const smtp = org?.settings?.smtp;
    if (!smtp?.host || !smtp?.user || !smtp?.pass) {
      return res.status(400).json({ success: false, smtpRequired: true, message: 'SMTP not configured. Go to Settings → Email (SMTP) to set up your email before sending.' });
    }
    const result = await emailService.sendCustomEmail({ to: lead.email, subject, body, orgSettings: org?.settings, smtpConfig: smtp });

    const emailLog = await EmailLog.create({
      leadId, organizationId: user.organizationId, workspaceId, userId: user.id,
      subject, body, status: result.success ? 'sent' : 'failed',
    });
    await LeadActivity.create({
      leadId, organizationId: user.organizationId, workspaceId, userId: user.id,
      type: 'email_sent',
      description: `Email sent: "${subject}"`,
      metadata: { emailLogId: emailLog.id, status: result.success ? 'sent' : 'failed' },
    });

    res.json({ success: result.success, message: result.success ? 'Email sent' : 'Email failed', error: result.error });
  } catch (err) {
    console.error('sendEmail error:', err);
    res.status(500).json({ success: false, message: 'Failed to send email' });
  }
};

const getCallLogs = async (req, res) => {
  try {
    const { user, workspaceId } = req;
    const { leadId } = req.query;
    const where = { organizationId: user.organizationId, workspaceId };
    if (leadId) where.leadId = leadId;
    const logs = await CallLog.findAll({ where, order: [['createdAt', 'DESC']], limit: 50 });
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch call logs' });
  }
};

module.exports = { logCall, logWhatsApp, sendEmail, getCallLogs };
