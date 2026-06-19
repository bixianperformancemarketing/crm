const { Op, literal } = require('sequelize');
const { Followup, Lead, User, LeadActivity } = require('../../config/models');
const { paginate, paginateResponse, startOfTodayIST, endOfTodayIST } = require('../../utils/helpers');
const notificationService = require('../../services/notificationService');

const getFollowups = async (req, res) => {
  try {
    const { user, workspaceId } = req;
    const { filter = 'all', page = 1, limit = 20, dateFrom, dateTo } = req.query;
    const { limit: lim, offset } = paginate(page, limit);
    const now = new Date();

    const ws = workspaceId ? { workspaceId } : {};
    const where = { organizationId: user.organizationId, ...ws };
    if (user.role === 'employee') where.userId = user.id;

    let order = [['scheduledAt', 'ASC']];

    if (filter === 'upcoming') {
      // Future pending followups only, nearest first
      where.status = 'pending';
      where.scheduledAt = { [Op.gte]: now };
    } else if (filter === 'overdue') {
      // Past due and not completed, oldest overdue first
      where.status = { [Op.in]: ['pending', 'overdue'] };
      where.scheduledAt = { [Op.lt]: now };
    } else if (filter === 'completed') {
      // Done, most recently completed first
      where.status = 'completed';
      order = [['completedAt', 'DESC']];
    } else {
      // 'all' — overdue first, then upcoming, then completed; exclude cancelled
      where.status = { [Op.in]: ['overdue', 'pending', 'completed'] };
      order = [
        [literal(`CASE WHEN \`Followup\`.\`status\` = 'overdue' THEN 1 WHEN \`Followup\`.\`status\` = 'pending' THEN 2 WHEN \`Followup\`.\`status\` = 'completed' THEN 3 ELSE 4 END`), 'ASC'],
        ['scheduledAt', 'ASC'],
      ];
    }

    if (dateFrom || dateTo) {
      const dateRange = {};
      if (dateFrom) dateRange[Op.gte] = new Date(dateFrom);
      if (dateTo) { const d = new Date(dateTo); d.setDate(d.getDate() + 1); dateRange[Op.lt] = d; }
      where.scheduledAt = where.scheduledAt ? { [Op.and]: [where.scheduledAt, dateRange] } : dateRange;
    }

    const { count, rows } = await Followup.findAndCountAll({
      where,
      include: [
        {
          model: Lead, as: 'lead', attributes: ['id', 'name', 'phone', 'status', 'priority'], required: false,
          include: [{ model: User, as: 'assignedAgent', attributes: ['id', 'name'], required: false }],
        },
        { model: User, as: 'user', attributes: ['id', 'name'], required: false },
      ],
      order,
      limit: lim,
      offset,
    });

    res.json({ success: true, ...paginateResponse(rows, count, page, lim) });
  } catch (err) {
    console.error('getFollowups error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch followups' });
  }
};

const createFollowup = async (req, res) => {
  try {
    const { user, workspaceId } = req;
    const { leadId, scheduledAt, note, userId } = req.body;
    if (!leadId || !scheduledAt) return res.status(400).json({ success: false, message: 'Lead and scheduled time required' });

    const ws = workspaceId ? { workspaceId } : {};
    const lead = await Lead.findOne({ where: { id: leadId, organizationId: user.organizationId, ...ws } });
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    const assignedUserId = userId || user.id;
    const followup = await Followup.create({
      leadId, organizationId: user.organizationId, workspaceId: lead.workspaceId,
      userId: assignedUserId, scheduledAt, note: note || '', status: 'pending',
    });

    await Lead.update({ nextFollowup: scheduledAt }, { where: { id: leadId } });
    await LeadActivity.create({
      leadId, organizationId: user.organizationId, workspaceId: lead.workspaceId,
      userId: user.id, type: 'followup_set',
      description: `Followup scheduled for ${new Date(scheduledAt).toLocaleString('en-IN')}`,
      metadata: { followupId: followup.id },
    });

    if (assignedUserId !== user.id) {
      await notificationService.create({
        organizationId: user.organizationId, workspaceId: lead.workspaceId, userId: assignedUserId,
        type: 'followup_due',
        title: 'Followup Assigned',
        message: `Followup with ${lead.name} scheduled for ${new Date(scheduledAt).toLocaleString('en-IN')}`,
        data: { followupId: followup.id, leadId },
      });
    }

    res.status(201).json({ success: true, message: 'Followup scheduled', followup });
  } catch (err) {
    console.error('createFollowup error:', err);
    res.status(500).json({ success: false, message: 'Failed to create followup' });
  }
};

const updateFollowup = async (req, res) => {
  try {
    const { id } = req.params;
    const { user, workspaceId } = req;
    const ws = workspaceId ? { workspaceId } : {};
    const followup = await Followup.findOne({ where: { id, organizationId: user.organizationId, ...ws } });
    if (!followup) return res.status(404).json({ success: false, message: 'Followup not found' });

    const { scheduledAt, note, status } = req.body;
    const updates = {};
    if (scheduledAt) updates.scheduledAt = scheduledAt;
    if (note !== undefined) updates.note = note;
    if (status) updates.status = status;
    await followup.update(updates);
    res.json({ success: true, message: 'Followup updated', followup });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update followup' });
  }
};

const completeFollowup = async (req, res) => {
  try {
    const { id } = req.params;
    const { user, workspaceId } = req;
    const { outcome, nextFollowupDate } = req.body;

    const ws = workspaceId ? { workspaceId } : {};
    const followup = await Followup.findOne({
      where: { id, organizationId: user.organizationId, ...ws },
      include: [{ model: Lead, as: 'lead', attributes: ['id', 'name'] }],
    });
    if (!followup) return res.status(404).json({ success: false, message: 'Followup not found' });

    await followup.update({ status: 'completed', completedAt: new Date(), outcome: outcome || '' });
    await LeadActivity.create({
      leadId: followup.leadId, organizationId: user.organizationId, workspaceId: followup.workspaceId,
      userId: user.id, type: 'followup_set',
      description: `Followup completed. Outcome: ${outcome || 'No outcome noted'}`,
      metadata: { followupId: followup.id },
    });

    if (nextFollowupDate) {
      await Followup.create({
        leadId: followup.leadId, organizationId: user.organizationId, workspaceId: followup.workspaceId,
        userId: followup.userId, scheduledAt: nextFollowupDate, status: 'pending',
        note: `Follow-up after: ${outcome || 'previous call'}`,
      });
      await Lead.update({ nextFollowup: nextFollowupDate }, { where: { id: followup.leadId } });
    }

    res.json({ success: true, message: 'Followup completed', followup });
  } catch (err) {
    console.error('completeFollowup error:', err);
    res.status(500).json({ success: false, message: 'Failed to complete followup' });
  }
};

const cancelFollowup = async (req, res) => {
  try {
    const { id } = req.params;
    const { user, workspaceId } = req;
    const ws = workspaceId ? { workspaceId } : {};
    const followup = await Followup.findOne({ where: { id, organizationId: user.organizationId, ...ws } });
    if (!followup) return res.status(404).json({ success: false, message: 'Followup not found' });
    await followup.update({ status: 'cancelled' });
    res.json({ success: true, message: 'Followup cancelled' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to cancel followup' });
  }
};

const getOverdueCount = async (req, res) => {
  try {
    const { user, workspaceId } = req;
    const ws = workspaceId ? { workspaceId } : {};
    const where = { organizationId: user.organizationId, ...ws, status: { [Op.in]: ['pending', 'overdue'] }, scheduledAt: { [Op.lt]: new Date() } };
    if (user.role === 'employee') where.userId = user.id;
    const count = await Followup.count({ where });
    res.json({ success: true, overdueCount: count });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch overdue count' });
  }
};

module.exports = { getFollowups, createFollowup, updateFollowup, completeFollowup, cancelFollowup, getOverdueCount };
