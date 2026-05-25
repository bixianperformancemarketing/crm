const scopeTenant = (req, res, next) => {
  if (!req.user) return next();
  req.organizationId = req.user.organizationId;
  req.workspaceId = req.user.workspaceId;
  next();
};

const requireWorkspace = (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Not authenticated' });
  const wsId = req.user.workspaceId || req.headers['x-workspace-id'] || req.query.workspaceId;
  if (!wsId) {
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
