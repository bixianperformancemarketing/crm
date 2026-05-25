const jwt = require('jsonwebtoken');
const { User, Organization, Workspace } = require('../config/models');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }

    const user = await User.findOne({
      where: { id: decoded.id, isActive: true },
      attributes: ['id', 'organizationId', 'workspaceId', 'name', 'email', 'role', 'label', 'phone', 'avatar', 'isActive', 'canUseContentCalendar'],
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found or inactive' });
    }

    if (user.role !== 'superadmin') {
      if (!user.organizationId) {
        return res.status(403).json({ success: false, message: 'No organization assigned' });
      }

      const org = await Organization.findOne({ where: { id: user.organizationId, isActive: true } });
      if (!org) {
        return res.status(403).json({ success: false, message: 'Organization not found or inactive' });
      }

      if (org.isSuspended) {
        return res.status(402).json({
          success: false,
          message: org.suspendedReason || 'Your account has been suspended. Please contact support.',
          suspended: true,
        });
      }

      if (org.planExpiresAt && new Date(org.planExpiresAt) < new Date()) {
        return res.status(402).json({
          success: false,
          message: 'Your subscription has expired. Please renew your plan to continue.',
          planExpired: true,
          upgradeRequired: true,
        });
      }

      req.org = org;
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(500).json({ success: false, message: 'Authentication error' });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Not authenticated' });
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Insufficient permissions' });
  }
  next();
};

const generateToken = (user) =>
  jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      workspaceId: user.workspaceId,
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

module.exports = { authenticate, requireRole, generateToken };
