const { Op } = require('sequelize');
const { Notification } = require('../../config/models');
const { paginate, paginateResponse } = require('../../utils/helpers');

const getNotifications = async (req, res) => {
  try {
    const { user } = req;
    const { page = 1, limit = 20, type, unreadOnly } = req.query;
    const { limit: lim, offset } = paginate(page, limit);
    const where = { userId: user.id, organizationId: user.organizationId };
    if (type) where.type = type;
    if (unreadOnly === 'true') where.isRead = false;

    const { count, rows } = await Notification.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: lim, offset,
    });
    res.json({ success: true, ...paginateResponse(rows, count, page, lim) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
  }
};

const getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.count({ where: { userId: req.user.id, organizationId: req.user.organizationId, isRead: false } });
    res.json({ success: true, count });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to get count' });
  }
};

const getRecent = async (req, res) => {
  try {
    const notifications = await Notification.findAll({
      where: { userId: req.user.id, organizationId: req.user.organizationId },
      order: [['createdAt', 'DESC']],
      limit: 10,
    });
    res.json({ success: true, notifications });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch recent notifications' });
  }
};

const markRead = async (req, res) => {
  try {
    const { id } = req.params;
    await Notification.update(
      { isRead: true, readAt: new Date() },
      { where: { id, userId: req.user.id, organizationId: req.user.organizationId } }
    );
    res.json({ success: true, message: 'Marked as read' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to mark as read' });
  }
};

const markAllRead = async (req, res) => {
  try {
    await Notification.update(
      { isRead: true, readAt: new Date() },
      { where: { userId: req.user.id, organizationId: req.user.organizationId, isRead: false } }
    );
    res.json({ success: true, message: 'All marked as read' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to mark all as read' });
  }
};

module.exports = { getNotifications, getUnreadCount, getRecent, markRead, markAllRead };
