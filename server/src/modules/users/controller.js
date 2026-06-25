const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { User } = require('../../config/models');
const { paginate, paginateResponse } = require('../../utils/helpers');

const getUsers = async (req, res) => {
  try {
    const { user, workspaceId } = req;
    const { page = 1, limit = 50, role, search, includeInactive } = req.query;
    const { limit: lim, offset } = paginate(page, limit);

    const where = { organizationId: user.organizationId, workspaceId: { [Op.ne]: null } };
    if (!includeInactive) where.isActive = true;
    if (workspaceId) where.workspaceId = workspaceId;
    if (role) where.role = role;
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await User.findAndCountAll({
      where,
      attributes: { exclude: ['password'] },
      order: [['name', 'ASC']],
      limit: lim, offset,
    });
    res.json({ success: true, ...paginateResponse(rows, count, page, lim) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
};

const getUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;
    const target = await User.findOne({
      where: { id, organizationId: user.organizationId },
      attributes: { exclude: ['password'] },
    });
    if (!target) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user: target });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch user' });
  }
};

const createUser = async (req, res) => {
  try {
    const { user, workspaceId } = req;
    const { name, email, password, role, phone, label, canUseContentCalendar, canAccessLeads } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ success: false, message: 'Name, email, password, and role are required' });
    }

    const allowedRoles = user.role === 'owner' ? ['admin', 'employee'] : ['employee'];
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ success: false, message: 'Cannot create user with this role' });
    }

    const existing = await User.findOne({ where: { email: email.toLowerCase() } });
    if (existing) {
      if (String(existing.organizationId) !== String(user.organizationId)) {
        return res.status(400).json({ success: false, message: 'This email is already in use' });
      }
      if (existing.isActive && existing.workspaceId) {
        return res.status(400).json({ success: false, message: 'Email already exists in this organization' });
      }
    }

    const hash = await bcrypt.hash(password, 12);

    let savedUser;
    if (existing && (!existing.isActive || !existing.workspaceId)) {
      await existing.update({
        workspaceId,
        name, password: hash, role, label: label || null,
        phone: phone || null,
        canUseContentCalendar: role === 'employee' ? !!canUseContentCalendar : false,
        canAccessLeads: role === 'employee' ? canAccessLeads !== false : true,
        isActive: true,
      });
      savedUser = existing;
    } else {
      savedUser = await User.create({
        organizationId: user.organizationId,
        workspaceId,
        name, email: email.toLowerCase(), password: hash, role, label: label || null,
        phone: phone || null,
        canUseContentCalendar: role === 'employee' ? !!canUseContentCalendar : false,
        canAccessLeads: role === 'employee' ? canAccessLeads !== false : true,
        isActive: true,
      });
    }

    const { password: _, ...userWithoutPassword } = savedUser.toJSON();
    res.status(201).json({ success: true, message: 'User created', user: userWithoutPassword });
  } catch (err) {
    console.error('createUser error:', err);
    res.status(500).json({ success: false, message: 'Failed to create user' });
  }
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { user, workspaceId } = req;
    const target = await User.findOne({ where: { id, organizationId: user.organizationId } });
    if (!target) return res.status(404).json({ success: false, message: 'User not found' });

    const { name, phone, isActive, password, label, canUseContentCalendar, canAccessLeads, role } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (phone !== undefined) updates.phone = phone;
    if (label !== undefined) updates.label = label;
    if (canUseContentCalendar !== undefined) updates.canUseContentCalendar = !!canUseContentCalendar;
    if (canAccessLeads !== undefined) updates.canAccessLeads = !!canAccessLeads;
    if (role && ['admin', 'employee'].includes(role) && user.role === 'owner') {
      updates.role = role;
      if (role === 'admin') { updates.canUseContentCalendar = false; }
    }
    if (isActive !== undefined) updates.isActive = isActive;
    if (password) {
      if (password.length < 8) return res.status(400).json({ success: false, message: 'Password too short' });
      updates.password = await bcrypt.hash(password, 12);
    }
    await target.update(updates);
    const { password: _, ...updated } = target.toJSON();
    res.json({ success: true, message: 'User updated', user: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update user' });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;
    if (parseInt(id) === user.id) return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
    const target = await User.findOne({ where: { id, organizationId: user.organizationId } });
    if (!target) return res.status(404).json({ success: false, message: 'User not found' });
    await target.destroy();
    res.json({ success: true, message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete user' });
  }
};

module.exports = { getUsers, getUser, createUser, updateUser, deleteUser };
