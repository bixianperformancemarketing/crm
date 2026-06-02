const { Op, fn, col, literal } = require('sequelize');
const crypto = require('crypto');
const {
  Organization, Workspace, User, Lead, Invoice, Payment, WebhookRoute,
} = require('../../config/models');
const { generateSlug } = require('../../utils/helpers');
const { checkWorkspaceLimit } = require('../../middleware/entitlement');

const getOwnerDashboard = async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const org = await Organization.findByPk(orgId, {
      attributes: ['id', 'name', 'plan', 'planExpiresAt', 'maxWorkspaces', 'maxLeadsTotal', 'settings'],
    });

    const workspaces = await Workspace.findAll({ where: { organizationId: orgId, isActive: true }, attributes: ['id', 'name'] });
    const wsIds = workspaces.map((w) => w.id);

    const [totalLeads, totalWorkspaces] = await Promise.all([
      Lead.count({ where: { organizationId: orgId } }),
      Workspace.count({ where: { organizationId: orgId, isActive: true } }),
    ]);

    const revenueByWorkspace = await Payment.findAll({
      where: { organizationId: orgId },
      attributes: ['workspaceId', [fn('SUM', col('amount')), 'total']],
      group: ['workspaceId'],
      raw: true,
    });

    const leadsByWorkspace = await Lead.findAll({
      where: { organizationId: orgId },
      attributes: ['workspaceId', [fn('COUNT', col('id')), 'count']],
      group: ['workspaceId'],
      raw: true,
    });

    const wsMap = {};
    workspaces.forEach((w) => { wsMap[w.id] = w.name; });

    res.json({
      success: true,
      org,
      stats: {
        totalLeads,
        totalWorkspaces,
        workspacesLimit: org.maxWorkspaces,
        leadsLimit: org.maxLeadsTotal,
      },
      revenueByWorkspace: revenueByWorkspace.map((r) => ({
        workspace: wsMap[r.workspaceId] || 'Unknown',
        workspaceId: r.workspaceId,
        total: parseFloat(r.total) || 0,
      })),
      leadsByWorkspace: leadsByWorkspace.map((l) => ({
        workspace: wsMap[l.workspaceId] || 'Unknown',
        workspaceId: l.workspaceId,
        count: parseInt(l.count) || 0,
      })),
    });
  } catch (err) {
    console.error('getOwnerDashboard error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard' });
  }
};

const getWorkspaces = async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const workspaces = await Workspace.findAll({
      where: { organizationId: orgId },
      order: [['createdAt', 'DESC']],
    });

    const withStats = await Promise.all(workspaces.map(async (ws) => {
      const [leadCount, userCount] = await Promise.all([
        Lead.count({ where: { workspaceId: ws.id } }),
        User.count({ where: { workspaceId: ws.id } }),
      ]);
      return { ...ws.toJSON(), leadCount, userCount };
    }));

    res.json({ success: true, workspaces: withStats });
  } catch (err) {
    console.error('getWorkspaces error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch workspaces' });
  }
};

const createWorkspace = async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Workspace name is required' });

    const org = await Organization.findByPk(orgId);
    const count = await Workspace.count({ where: { organizationId: orgId, isActive: true } });
    if (count >= org.maxWorkspaces) {
      return res.status(403).json({
        success: false, limitReached: true, limitType: 'workspaces', upgradeRequired: true,
        message: `You have reached your workspace limit (${org.maxWorkspaces}) on the ${org.plan} plan.`,
      });
    }

    const slug = generateSlug(name);
    let uniqueSlug = slug;
    let counter = 1;
    while (await Workspace.findOne({ where: { organizationId: orgId, slug: uniqueSlug } })) {
      uniqueSlug = `${slug}-${counter++}`;
    }

    const ws = await Workspace.create({
      organizationId: orgId,
      name,
      slug: uniqueSlug,
      description: description || '',
      isActive: true,
      webhookToken: crypto.randomBytes(32).toString('hex'),
      settings: {},
    });
    res.status(201).json({ success: true, message: 'Workspace created', workspace: ws });
  } catch (err) {
    console.error('createWorkspace error:', err);
    res.status(500).json({ success: false, message: 'Failed to create workspace' });
  }
};

const getWorkspaceById = async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.user.organizationId;
    const ws = await Workspace.findOne({ where: { id, organizationId: orgId } });
    if (!ws) return res.status(404).json({ success: false, message: 'Workspace not found' });

    const [users, leadCount, revenue] = await Promise.all([
      User.findAll({ where: { workspaceId: ws.id }, attributes: ['id', 'name', 'email', 'role', 'isActive', 'createdAt'], order: [['createdAt', 'DESC']] }),
      Lead.count({ where: { workspaceId: ws.id } }),
      Payment.findAll({ where: { workspaceId: ws.id }, attributes: [[fn('SUM', col('amount')), 'total']], raw: true }),
    ]);

    res.json({
      success: true,
      workspace: {
        ...ws.toJSON(),
        userCount: users.length,
        leadCount,
        totalRevenue: parseFloat(revenue[0]?.total) || 0,
        users,
      },
    });
  } catch (err) {
    console.error('getWorkspaceById error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch workspace' });
  }
};

const updateWorkspace = async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.user.organizationId;
    const ws = await Workspace.findOne({ where: { id, organizationId: orgId } });
    if (!ws) return res.status(404).json({ success: false, message: 'Workspace not found' });

    const { name, description, isActive } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (isActive !== undefined) updates.isActive = isActive;
    await ws.update(updates);
    res.json({ success: true, message: 'Workspace updated', workspace: ws });
  } catch (err) {
    console.error('updateWorkspace error:', err);
    res.status(500).json({ success: false, message: 'Failed to update workspace' });
  }
};

const deleteWorkspace = async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.user.organizationId;
    const ws = await Workspace.findOne({ where: { id, organizationId: orgId } });
    if (!ws) return res.status(404).json({ success: false, message: 'Workspace not found' });

    const [userCount, leadCount] = await Promise.all([
      User.count({ where: { workspaceId: ws.id } }),
      Lead.count({ where: { workspaceId: ws.id } }),
    ]);

    if (userCount > 0) {
      return res.status(400).json({ success: false, message: `Cannot delete: ${userCount} user(s) are still assigned to this workspace. Remove or reassign them first.` });
    }
    if (leadCount > 0) {
      return res.status(400).json({ success: false, message: `Cannot delete: ${leadCount} lead(s) exist in this workspace. Delete or move them first.` });
    }

    await ws.destroy();
    res.json({ success: true, message: 'Workspace deleted' });
  } catch (err) {
    console.error('deleteWorkspace error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete workspace' });
  }
};

const getOrgReports = async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const { months = 6 } = req.query;
    const since = new Date(); since.setMonth(since.getMonth() - parseInt(months));

    const [totalRevenue, leadsByStatus, recentPayments] = await Promise.all([
      Payment.findAll({
        where: { organizationId: orgId, createdAt: { [Op.gte]: since } },
        attributes: [[fn('SUM', col('amount')), 'total'], [fn('MONTH', col('receivedAt')), 'month'], [fn('YEAR', col('receivedAt')), 'year']],
        group: [fn('MONTH', col('receivedAt')), fn('YEAR', col('receivedAt'))],
        raw: true,
      }),
      Lead.findAll({
        where: { organizationId: orgId },
        attributes: ['status', [fn('COUNT', col('id')), 'count']],
        group: ['status'],
        raw: true,
      }),
      Payment.findAll({
        where: { organizationId: orgId },
        order: [['createdAt', 'DESC']],
        limit: 10,
      }),
    ]);

    res.json({ success: true, totalRevenue, leadsByStatus, recentPayments });
  } catch (err) {
    console.error('getOrgReports error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch org reports' });
  }
};

const getOrgSettings = async (req, res) => {
  try {
    const org = await Organization.findByPk(req.user.organizationId, {
      attributes: ['id', 'name', 'settings', 'webhookToken', 'plan', 'maxWorkspaces', 'maxUsersPerWorkspace', 'maxLeadsTotal'],
    });
    res.json({ success: true, organization: org });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch settings' });
  }
};

const updateOrgSettings = async (req, res) => {
  try {
    const org = await Organization.findByPk(req.user.organizationId);
    const currentSettings = org.settings || {};

    let newSettings;
    if (req.body.settings) {
      // Frontend sends { settings: { branding, bankDetails, smtp, ... } }
      newSettings = { ...currentSettings, ...req.body.settings };
    } else {
      // Legacy direct fields
      const { branding, smtpConfig, bankDetails } = req.body;
      newSettings = { ...currentSettings };
      if (branding !== undefined) newSettings.branding = branding;
      if (smtpConfig !== undefined) newSettings.smtpConfig = smtpConfig;
      if (bankDetails !== undefined) newSettings.bankDetails = bankDetails;
    }

    await org.update({ settings: newSettings });
    res.json({ success: true, message: 'Settings updated', settings: newSettings });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update settings' });
  }
};

const getWebhookWorkspaces = async (req, res) => {
  try {
    const workspaces = await Workspace.findAll({
      where: { organizationId: req.user.organizationId, isActive: true },
      attributes: ['id', 'name', 'webhookToken'],
      order: [['name', 'ASC']],
    });
    res.json({ success: true, workspaces });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch workspaces' });
  }
};

const getWebhookRoutes = async (req, res) => {
  try {
    const routes = await WebhookRoute.findAll({
      where: { organizationId: req.user.organizationId },
      include: [{ model: Workspace, as: 'workspace', attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC']],
    });
    res.json({ success: true, routes });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch webhook routes' });
  }
};

const createWebhookRoute = async (req, res) => {
  try {
    const { workspaceId, matchType, matchValue, label } = req.body;
    if (!workspaceId || !matchType || !matchValue) {
      return res.status(400).json({ success: false, message: 'workspaceId, matchType, matchValue are required' });
    }
    const ws = await Workspace.findOne({ where: { id: workspaceId, organizationId: req.user.organizationId } });
    if (!ws) return res.status(404).json({ success: false, message: 'Workspace not found' });

    const existing = await WebhookRoute.findOne({
      where: { organizationId: req.user.organizationId, matchType, matchValue: matchValue.trim() },
    });
    if (existing) return res.status(409).json({ success: false, message: `A route for this ${matchType} already exists` });

    const route = await WebhookRoute.create({
      organizationId: req.user.organizationId, workspaceId, matchType,
      matchValue: matchValue.trim(), label: label || matchValue.trim(),
    });
    const full = await WebhookRoute.findByPk(route.id, {
      include: [{ model: Workspace, as: 'workspace', attributes: ['id', 'name'] }],
    });
    res.status(201).json({ success: true, route: full });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create webhook route' });
  }
};

const updateWebhookRoute = async (req, res) => {
  try {
    const route = await WebhookRoute.findOne({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!route) return res.status(404).json({ success: false, message: 'Route not found' });
    const { label, isActive } = req.body;
    await route.update({ label, isActive });
    res.json({ success: true, route });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update webhook route' });
  }
};

const deleteWebhookRoute = async (req, res) => {
  try {
    const route = await WebhookRoute.findOne({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!route) return res.status(404).json({ success: false, message: 'Route not found' });
    await route.destroy();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete webhook route' });
  }
};

module.exports = {
  getOwnerDashboard, getWorkspaces, createWorkspace, getWorkspaceById, updateWorkspace, deleteWorkspace,
  getOrgReports, getOrgSettings, updateOrgSettings,
  getWebhookWorkspaces, getWebhookRoutes, createWebhookRoute, updateWebhookRoute, deleteWebhookRoute,
};
