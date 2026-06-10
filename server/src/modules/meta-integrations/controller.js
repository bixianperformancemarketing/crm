const axios = require('axios');
const { MetaIntegration, Workspace, Organization } = require('../../config/models');
const metaSyncService = require('../../services/metaSyncService');

const META_BASE = 'https://graph.facebook.com/v19.0';

const list = async (req, res) => {
  try {
    const integrations = await MetaIntegration.findAll({
      where: { organizationId: req.user.organizationId },
      include: [{ model: Workspace, as: 'workspace', attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC']],
      attributes: { exclude: ['accessToken'] },
    });
    res.json({ success: true, integrations });
  } catch (err) {
    console.error('MetaIntegration list error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch integrations' });
  }
};

const connect = async (req, res) => {
  try {
    const org = await Organization.findByPk(req.user.organizationId);
    if (!org?.canUseWebhooks) {
      return res.status(403).json({ success: false, message: 'Meta Ads integration requires Growth or Company plan' });
    }

    const { fbPageId, fbPageName, accessToken, workspaceId } = req.body;
    if (!fbPageId || !accessToken || !workspaceId) {
      return res.status(400).json({ success: false, message: 'fbPageId, accessToken, and workspaceId are required' });
    }

    const ws = await Workspace.findOne({ where: { id: workspaceId, organizationId: req.user.organizationId } });
    if (!ws) return res.status(404).json({ success: false, message: 'Workspace not found' });

    const existing = await MetaIntegration.findOne({
      where: { organizationId: req.user.organizationId, fbPageId: fbPageId.trim() },
    });
    if (existing) return res.status(409).json({ success: false, message: 'This Facebook Page is already connected' });

    const integration = await MetaIntegration.create({
      organizationId: req.user.organizationId,
      workspaceId,
      fbPageId: fbPageId.trim(),
      fbPageName: fbPageName?.trim() || fbPageId.trim(),
      accessToken,
      isActive: true,
    });

    const full = await MetaIntegration.findByPk(integration.id, {
      include: [{ model: Workspace, as: 'workspace', attributes: ['id', 'name'] }],
      attributes: { exclude: ['accessToken'] },
    });

    res.status(201).json({ success: true, integration: full, message: 'Page connected successfully' });
  } catch (err) {
    console.error('MetaIntegration connect error:', err);
    res.status(500).json({ success: false, message: 'Failed to connect page' });
  }
};

const update = async (req, res) => {
  try {
    const integration = await MetaIntegration.findOne({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!integration) return res.status(404).json({ success: false, message: 'Integration not found' });

    const { fbPageName, accessToken, workspaceId, isActive } = req.body;
    const updates = {};
    if (fbPageName) updates.fbPageName = fbPageName.trim();
    if (accessToken) updates.accessToken = accessToken;
    if (workspaceId) updates.workspaceId = workspaceId;
    if (isActive !== undefined) updates.isActive = isActive;
    if (Object.keys(updates).length > 0) {
      updates.syncStatus = 'idle';
      updates.lastSyncError = null;
    }

    await integration.update(updates);
    const updated = await MetaIntegration.findByPk(integration.id, {
      include: [{ model: Workspace, as: 'workspace', attributes: ['id', 'name'] }],
      attributes: { exclude: ['accessToken'] },
    });
    res.json({ success: true, integration: updated });
  } catch (err) {
    console.error('MetaIntegration update error:', err);
    res.status(500).json({ success: false, message: 'Failed to update integration' });
  }
};

const disconnect = async (req, res) => {
  try {
    const integration = await MetaIntegration.findOne({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!integration) return res.status(404).json({ success: false, message: 'Integration not found' });
    await integration.destroy();
    res.json({ success: true, message: 'Page disconnected' });
  } catch (err) {
    console.error('MetaIntegration disconnect error:', err);
    res.status(500).json({ success: false, message: 'Failed to disconnect page' });
  }
};

const manualSync = async (req, res) => {
  try {
    const integration = await MetaIntegration.findOne({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!integration) return res.status(404).json({ success: false, message: 'Integration not found' });
    if (!integration.isActive) return res.status(400).json({ success: false, message: 'Integration is disabled' });

    // Respond immediately — sync runs in background to avoid HTTP timeout with large form counts
    res.json({ success: true, message: 'Sync started. Check back in a moment for results.' });
    metaSyncService.syncOneIntegration(integration).catch(err => {
      console.error(`[MetaSync] Manual sync error for page ${integration.fbPageId}:`, err.message);
    });
  } catch (err) {
    console.error('MetaIntegration manualSync error:', err);
    res.status(500).json({ success: false, message: err.message || 'Sync failed' });
  }
};

const getForms = async (req, res) => {
  try {
    const integration = await MetaIntegration.findOne({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!integration) return res.status(404).json({ success: false, message: 'Integration not found' });

    const response = await axios.get(`${META_BASE}/${integration.fbPageId}/leadgen_forms`, {
      params: { access_token: integration.accessToken, fields: 'id,name,status', limit: 100 },
      timeout: 15000,
    });

    const forms = (response.data?.data || []).map(f => ({
      id: f.id,
      name: f.name,
      status: f.status,
    }));

    res.json({ success: true, forms });
  } catch (err) {
    const message = err.response?.data?.error?.message || err.message;
    res.status(500).json({ success: false, message: `Failed to fetch forms: ${message}` });
  }
};

const updateFormRoutes = async (req, res) => {
  try {
    const integration = await MetaIntegration.findOne({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!integration) return res.status(404).json({ success: false, message: 'Integration not found' });

    const { formRoutes } = req.body;
    if (!Array.isArray(formRoutes)) {
      return res.status(400).json({ success: false, message: 'formRoutes must be an array' });
    }

    // Validate each route belongs to this org's workspaces
    for (const route of formRoutes) {
      if (!route.formId || !route.workspaceId) {
        return res.status(400).json({ success: false, message: 'Each route needs formId and workspaceId' });
      }
      const ws = await Workspace.findOne({ where: { id: route.workspaceId, organizationId: req.user.organizationId } });
      if (!ws) return res.status(404).json({ success: false, message: `Workspace ${route.workspaceId} not found` });
    }

    await integration.update({ formRoutes });
    res.json({ success: true, formRoutes, message: 'Form routes updated' });
  } catch (err) {
    console.error('updateFormRoutes error:', err);
    res.status(500).json({ success: false, message: 'Failed to update form routes' });
  }
};

const backfillNames = async (req, res) => {
  try {
    const result = await metaSyncService.backfillMetaLeadNames(req.user.organizationId);
    res.json({ success: true, ...result, message: `Updated ${result.updated} of ${result.total} Unknown leads` });
  } catch (err) {
    console.error('backfillNames error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const testConnection = async (req, res) => {
  try {
    const integration = await MetaIntegration.findOne({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!integration) return res.status(404).json({ success: false, message: 'Integration not found' });

    const pageRes = await axios.get(`${META_BASE}/${integration.fbPageId}`, {
      params: { access_token: integration.accessToken, fields: 'id,name' },
      timeout: 10000,
    });

    const formsRes = await axios.get(`${META_BASE}/${integration.fbPageId}/leadgen_forms`, {
      params: { access_token: integration.accessToken, fields: 'id,name,leads_count', limit: 100 },
      timeout: 10000,
    });

    const forms = formsRes.data?.data || [];
    const totalLeadsInMeta = forms.reduce((sum, f) => sum + (f.leads_count || 0), 0);

    res.json({
      success: true,
      tokenValid: true,
      pageName: pageRes.data?.name,
      formCount: forms.length,
      totalLeadsInMeta,
      syncStatus: integration.syncStatus,
      lastSyncAt: integration.lastSyncAt,
      lastSyncError: integration.lastSyncError,
    });
  } catch (err) {
    const metaError = err.response?.data?.error;
    res.json({
      success: false,
      tokenValid: false,
      error: metaError?.message || err.message,
      errorCode: metaError?.code,
      syncStatus: null,
    });
  }
};

module.exports = { list, connect, update, disconnect, manualSync, getForms, updateFormRoutes, backfillNames, testConnection };
