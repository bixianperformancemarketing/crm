const { Op } = require('sequelize');
const { Lead, User, Workspace, UsageLog } = require('../config/models');
const { limitReachedResponse } = require('../utils/helpers');

const logUsage = async (organizationId, workspaceId, metric) => {
  try {
    await UsageLog.create({ organizationId, workspaceId, metric, loggedAt: new Date() });
  } catch {}
};

const checkWorkspaceLimit = async (req, res, next) => {
  try {
    const { org } = req;
    if (!org) return next();
    const count = await Workspace.count({ where: { organizationId: org.id, isActive: true } });
    if (count >= org.maxWorkspaces) {
      return limitReachedResponse(res, 'workspaces', org.plan);
    }
    next();
  } catch (err) {
    res.status(500).json({ success: false, message: 'Entitlement check failed' });
  }
};

const checkUserLimit = async (req, res, next) => {
  try {
    const { org, user } = req;
    if (!org) return next();
    const workspaceId = req.workspaceId || req.body.workspaceId || user.workspaceId;
    if (!workspaceId) return next();
    const count = await User.count({ where: { workspaceId, organizationId: org.id, isActive: true } });
    if (count >= org.maxUsersPerWorkspace) {
      return limitReachedResponse(res, 'users per workspace', org.plan);
    }
    next();
  } catch (err) {
    res.status(500).json({ success: false, message: 'Entitlement check failed' });
  }
};

const checkLeadLimit = async (req, res, next) => {
  try {
    const { org } = req;
    if (!org) return next();
    const count = await Lead.count({ where: { organizationId: org.id } });
    if (count >= org.maxLeadsTotal) {
      return limitReachedResponse(res, 'leads', org.plan);
    }
    next();
  } catch (err) {
    res.status(500).json({ success: false, message: 'Entitlement check failed' });
  }
};

const checkFeature = (feature) => (req, res, next) => {
  const { org } = req;
  if (!org) return next();
  if (!org[feature]) {
    return res.status(403).json({
      success: false,
      limitReached: true,
      limitType: 'feature',
      upgradeRequired: true,
      message: `This feature is not available on your current ${org.plan} plan. Please upgrade to access it.`,
      feature,
    });
  }
  next();
};

module.exports = { checkWorkspaceLimit, checkUserLimit, checkLeadLimit, checkFeature, logUsage };
