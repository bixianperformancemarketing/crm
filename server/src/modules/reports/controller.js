const { Op, fn, col, literal } = require('sequelize');
const moment = require('moment-timezone');
const { Lead, Payment, Invoice, Followup, Appointment, ContentTask, User, Quotation } = require('../../config/models');
const { startOfTodayIST, endOfTodayIST, IST } = require('../../utils/helpers');

const getDashboard = async (req, res) => {
  try {
    const { user, workspaceId } = req;
    const orgId = user.organizationId;
    const now = new Date();

    const [
      totalLeads, activeLeads, wonLeads, hotLeads,
      totalRevenue, pendingRevenue, overdueInvoices,
      pendingFollowups, overdueFollowups, todayAppts,
      recentLeads,
    ] = await Promise.all([
      Lead.count({ where: { organizationId: orgId, workspaceId } }),
      Lead.count({ where: { organizationId: orgId, workspaceId, status: { [Op.notIn]: ['Won', 'Lost'] } } }),
      Lead.count({ where: { organizationId: orgId, workspaceId, status: 'Won' } }),
      Lead.count({ where: { organizationId: orgId, workspaceId, isHot: true } }),
      Payment.sum('amount', { where: { organizationId: orgId, workspaceId } }),
      Invoice.sum('dueAmount', { where: { organizationId: orgId, workspaceId, status: { [Op.in]: ['Unpaid', 'Partial'] } } }),
      Invoice.count({ where: { organizationId: orgId, workspaceId, status: 'Overdue' } }),
      Followup.count({ where: { organizationId: orgId, workspaceId, status: 'pending', scheduledAt: { [Op.gte]: now } } }),
      Followup.count({ where: { organizationId: orgId, workspaceId, status: { [Op.in]: ['pending', 'overdue'] }, scheduledAt: { [Op.lt]: now } } }),
      Appointment.count({ where: { organizationId: orgId, workspaceId, startTime: { [Op.between]: [startOfTodayIST(), endOfTodayIST()] }, status: 'Scheduled' } }),
      Lead.findAll({ where: { organizationId: orgId, workspaceId }, order: [['createdAt', 'DESC']], limit: 5, attributes: ['id', 'name', 'status', 'priority', 'source', 'createdAt'] }),
    ]);

    const conversionRate = totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0;
    const wonInvoices = await Invoice.findAll({ where: { organizationId: orgId, workspaceId, status: 'Paid' } });
    const avgDealSize = wonInvoices.length ? wonInvoices.reduce((s, i) => s + parseFloat(i.totalAmount), 0) / wonInvoices.length : 0;

    const since12mo = new Date(); since12mo.setMonth(since12mo.getMonth() - 12);
    const monthlyRevenue = await Payment.findAll({
      where: { organizationId: orgId, workspaceId, receivedAt: { [Op.gte]: since12mo } },
      attributes: [[fn('YEAR', col('receivedAt')), 'year'], [fn('MONTH', col('receivedAt')), 'month'], [fn('SUM', col('amount')), 'total']],
      group: [fn('YEAR', col('receivedAt')), fn('MONTH', col('receivedAt'))],
      order: [[fn('YEAR', col('receivedAt')), 'ASC'], [fn('MONTH', col('receivedAt')), 'ASC']],
      raw: true,
    });

    const leadByStatus = await Lead.findAll({
      where: { organizationId: orgId, workspaceId },
      attributes: ['status', [fn('COUNT', col('id')), 'count']],
      group: ['status'], raw: true,
    });

    const leadBySource = await Lead.findAll({
      where: { organizationId: orgId, workspaceId },
      attributes: ['source', [fn('COUNT', col('id')), 'count']],
      group: ['source'], raw: true,
    });

    const since6mo = new Date(); since6mo.setMonth(since6mo.getMonth() - 6);
    const leadVolume = await Lead.findAll({
      where: { organizationId: orgId, workspaceId, createdAt: { [Op.gte]: since6mo } },
      attributes: [[fn('YEAR', col('createdAt')), 'year'], [fn('MONTH', col('createdAt')), 'month'], [fn('COUNT', col('id')), 'count']],
      group: [fn('YEAR', col('createdAt')), fn('MONTH', col('createdAt'))],
      order: [[fn('YEAR', col('createdAt')), 'ASC'], [fn('MONTH', col('createdAt')), 'ASC']],
      raw: true,
    });

    const todayFollowups = await Followup.findAll({
      where: { organizationId: orgId, workspaceId, status: 'pending', scheduledAt: { [Op.between]: [startOfTodayIST(), endOfTodayIST()] } },
      include: [{ model: Lead, as: 'lead', attributes: ['id', 'name', 'phone'], required: false }],
      order: [['scheduledAt', 'ASC']], limit: 10,
    });

    const todayAppointments = await Appointment.findAll({
      where: { organizationId: orgId, workspaceId, startTime: { [Op.between]: [startOfTodayIST(), endOfTodayIST()] }, status: 'Scheduled' },
      include: [
        { model: Lead, as: 'lead', attributes: ['id', 'name'], required: false },
        { model: User, as: 'assignee', attributes: ['id', 'name'], required: false },
      ],
      order: [['startTime', 'ASC']], limit: 10,
    });

    res.json({
      success: true,
      stats: {
        totalLeads, activeLeads, wonLeads, hotLeads,
        totalRevenue: parseFloat(totalRevenue) || 0,
        pendingRevenue: parseFloat(pendingRevenue) || 0,
        overdueInvoices, pendingFollowups, overdueFollowups, todayAppts,
        conversionRate, avgDealSize: Math.round(avgDealSize),
      },
      charts: { monthlyRevenue, leadByStatus, leadBySource, leadVolume },
      todayFollowups,
      todayAppointments,
      recentLeads,
    });
  } catch (err) {
    console.error('getDashboard error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard' });
  }
};

const getAdvancedReports = async (req, res) => {
  try {
    const { user, workspaceId } = req;
    const orgId = user.organizationId;
    const { dateFrom, dateTo } = req.query;
    const dateFilter = {};
    if (dateFrom) dateFilter[Op.gte] = new Date(dateFrom);
    if (dateTo) dateFilter[Op.lte] = new Date(dateTo);
    const hasDateFilter = Object.keys(dateFilter).length > 0;

    const leadWhere = { organizationId: orgId, workspaceId };
    if (hasDateFilter) leadWhere.createdAt = dateFilter;

    const [leadBySource, revBySource, agentPerformance, contentStats, revenueByMonth] = await Promise.all([
      Lead.findAll({
        where: leadWhere,
        attributes: ['source', [fn('COUNT', col('id')), 'count']],
        group: ['source'], raw: true,
      }),
      Payment.findAll({
        where: { organizationId: orgId, workspaceId, ...(hasDateFilter ? { receivedAt: dateFilter } : {}) },
        attributes: [[fn('SUM', col('amount')), 'total']],
        raw: true,
      }),
      User.findAll({
        where: { workspaceId, organizationId: orgId, role: { [Op.in]: ['employee', 'admin'] }, isActive: true },
        attributes: ['id', 'name', 'label'],
        include: [{
          model: Lead, as: 'assignedLeads',
          attributes: ['status'],
          required: false,
        }],
      }),
      ContentTask.findAll({
        where: { organizationId: orgId, workspaceId },
        attributes: ['status', [fn('COUNT', col('id')), 'count']],
        group: ['status'], raw: true,
      }),
      Payment.findAll({
        where: { organizationId: orgId, workspaceId },
        attributes: [[fn('YEAR', col('receivedAt')), 'year'], [fn('MONTH', col('receivedAt')), 'month'], [fn('SUM', col('amount')), 'total']],
        group: [fn('YEAR', col('receivedAt')), fn('MONTH', col('receivedAt'))],
        order: [[fn('YEAR', col('receivedAt')), 'ASC'], [fn('MONTH', col('receivedAt')), 'ASC']],
        raw: true,
      }),
    ]);

    const agentStats = agentPerformance.map((agent) => {
      const leads = agent.assignedLeads || [];
      const total = leads.length;
      const won = leads.filter((l) => l.status === 'Won').length;
      return {
        id: agent.id,
        name: agent.name,
        label: agent.label || agent.role,
        totalLeads: total,
        wonLeads: won,
        conversionRate: total > 0 ? Math.round((won / total) * 100) : 0,
      };
    });

    res.json({
      success: true,
      leadBySource,
      revenueByMonth,
      agentStats,
      contentStats,
    });
  } catch (err) {
    console.error('getAdvancedReports error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch reports' });
  }
};

module.exports = { getDashboard, getAdvancedReports };
