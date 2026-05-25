const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { User, Organization, Workspace } = require('../../config/models');
const { generateToken } = require('../../middleware/auth');
const emailService = require('../../services/emailService');

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const user = await User.findOne({
      where: { email: email.toLowerCase().trim() },
      order: [['isActive', 'DESC'], ['createdAt', 'DESC']],
      include: [
        { model: Organization, as: 'organization', required: false, attributes: ['id', 'name', 'slug', 'plan', 'planExpiresAt', 'isActive', 'isSuspended', 'suspendedReason', 'settings', 'maxWorkspaces', 'maxUsersPerWorkspace', 'maxLeadsTotal', 'canUseWebhooks', 'canUsePDF', 'canUseCSVImport', 'canUseContentCalendar', 'canUseAdvancedReports'] },
        { model: Workspace, as: 'workspace', required: false, attributes: ['id', 'name', 'slug', 'settings'] },
      ],
    });

    if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });
    if (!user.isActive) return res.status(401).json({ success: false, message: 'Account is inactive' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    if (user.role !== 'superadmin') {
      const org = user.organization;
      if (!org || !org.isActive) return res.status(403).json({ success: false, message: 'Organization not found or inactive' });
      if (org.isSuspended) return res.status(402).json({ success: false, message: org.suspendedReason || 'Account suspended', suspended: true });
      if (org.planExpiresAt && new Date(org.planExpiresAt) < new Date()) {
        return res.status(402).json({ success: false, message: 'Subscription expired. Please renew.', planExpired: true, upgradeRequired: true });
      }
    }

    await user.update({ lastLogin: new Date() });
    const token = generateToken(user);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        label: user.label,
        phone: user.phone,
        avatar: user.avatar,
        organizationId: user.organizationId,
        workspaceId: user.workspaceId,
        organization: user.organization,
        workspace: user.workspace,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Login failed' });
  }
};

const getMe = async (req, res) => {
  try {
    const user = await User.findOne({
      where: { id: req.user.id },
      attributes: { exclude: ['password'] },
      include: [
        { model: Organization, as: 'organization', required: false, attributes: ['id', 'name', 'slug', 'plan', 'planExpiresAt', 'isActive', 'settings', 'maxWorkspaces', 'maxUsersPerWorkspace', 'maxLeadsTotal', 'canUseWebhooks', 'canUsePDF', 'canUseCSVImport', 'canUseContentCalendar', 'canUseAdvancedReports', 'webhookToken'] },
        { model: Workspace, as: 'workspace', required: false, attributes: ['id', 'name', 'slug', 'settings'] },
      ],
    });
    res.json({ success: true, user });
  } catch (err) {
    console.error('getMe error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch user' });
  }
};

const changePassword = async (req, res) => {
  try {
    // Agents are not allowed to change their password
    if (req.user.role === 'employee') {
      return res.status(403).json({ success: false, message: 'Employees cannot change their password. Contact your admin.' });
    }

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current and new password required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }

    const user = await User.findByPk(req.user.id);
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(400).json({ success: false, message: 'Current password is incorrect' });

    const hash = await bcrypt.hash(newPassword, 12);
    await user.update({ password: hash });
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    console.error('changePassword error:', err);
    res.status(500).json({ success: false, message: 'Failed to change password' });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const user = await User.findOne({ where: { email: email.toLowerCase().trim(), isActive: true } });
    // Always return success to prevent email enumeration
    if (!user || user.role === 'employee') {
      return res.json({ success: true, message: 'If that email is registered, a reset link has been sent.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.update({ passwordResetToken: token, passwordResetExpiry: expiry });

    const resetLink = `${process.env.CLIENT_URL || 'http://localhost'}/reset-password/${token}`;
    await emailService.sendPasswordResetEmail(user.email, user.name, resetLink);

    res.json({ success: true, message: 'If that email is registered, a reset link has been sent.' });
  } catch (err) {
    console.error('forgotPassword error:', err);
    res.status(500).json({ success: false, message: 'Failed to process request' });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ success: false, message: 'Token and new password are required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }

    const user = await User.findOne({
      where: { passwordResetToken: token, isActive: true },
    });

    if (!user) return res.status(400).json({ success: false, message: 'Invalid or expired reset link' });
    if (!user.passwordResetExpiry || new Date(user.passwordResetExpiry) < new Date()) {
      return res.status(400).json({ success: false, message: 'Reset link has expired. Request a new one.' });
    }

    const hash = await bcrypt.hash(newPassword, 12);
    await user.update({ password: hash, passwordResetToken: null, passwordResetExpiry: null });

    res.json({ success: true, message: 'Password reset successfully. You can now log in.' });
  } catch (err) {
    console.error('resetPassword error:', err);
    res.status(500).json({ success: false, message: 'Failed to reset password' });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { name, phone } = req.body;
    const updates = {};
    if (name) updates.name = name.trim();
    if (phone) updates.phone = phone.trim();
    await User.update(updates, { where: { id: req.user.id } });
    const updated = await User.findByPk(req.user.id, { attributes: { exclude: ['password'] } });
    res.json({ success: true, message: 'Profile updated', user: updated });
  } catch (err) {
    console.error('updateProfile error:', err);
    res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
};

module.exports = { login, getMe, changePassword, forgotPassword, resetPassword, updateProfile };
