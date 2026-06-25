const { Workspace } = require('../config/models');

const scopeTenant = (req, res, next) => {
  if (!req.user) return next();
  req.organizationId = req.user.organizationId;
  req.workspaceId = req.user.workspaceId;
  next();
};

const requireWorkspace = async (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Not authenticated' });
  const wsId = req.user.workspaceId || req.headers['x-workspace-id'] || req.query.workspaceId || req.body?.workspaceId;
  if (!wsId) {
    if (req.user.role === 'owner') {
      try {
        const ws = await Workspace.findOne({ where: { organizationId: req.user.organizationId }, order: [['id', 'ASC']] });
        req.workspaceId = ws ? ws.id : undefined;
      } catch { req.workspaceId = undefined; }
      return next();
    }
    return res.status(400).json({ success: false, message: 'Workspace context required' });
  }
  req.workspaceId = parseInt(wsId);
  next();
};

const requireOrg = (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Not authenticated' });
  if (!req.user.organizationId) {
    return res.status(400).json({ success: false, message: 'Organization context required' });
  }
  req.organizationId = req.user.organizationId;
  next();
};

module.exports = { scopeTenant, requireWorkspace, requireOrg };
