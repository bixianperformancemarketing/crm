const { Op, fn, col, literal } = require('sequelize');
const moment = require('moment-timezone');
const { Lead, Payment, Invoice, Followup, Appointment, ContentTask, User, Quotation } = require('../../config/models');
const { startOfTodayIST, endOfTodayIST, IST } = require('../../utils/helpers');

const getLoginSummary = async (req, res) => {
  try {
    const { user, workspaceId } = req;
    const orgId = user.organizationId;
    const now = new Date();
    const isEmployee = user.role === 'employee';

    const leadWhere   = { organizationId: orgId, workspaceId, ...(isEmployee ? { assignedTo: user.id } : {}) };
    const fupWhere    = { organizationId: orgId, workspaceId, ...(isEmployee ? { userId: user.id } : {}) };
    const quotWhere   = { organizationId: orgId, workspaceId, ...(isEmployee ? { createdBy: user.id } : {}) };
    const contentWhere= { organizationId: orgId, workspaceId, ...(isEmployee ? { assignedTo: user.id } : {}) };
    const apptWhere   = { organizationId: orgId, workspaceId, ...(isEmployee ? { assignedTo: user.id } : {}), status: 'Scheduled' };

    const [
      overdueFollowups,
      todayFollowups,
      completedFollowupsToday,
      activeLeads,
      newLeads,
      convertedToday,
      pendingQuotations,
      pendingContent,
      todayAppointments,
    ] = await Promise.all([
      Followup.findAll({
        where: { ...fupWhere, status: { [Op.in]: ['pending', 'overdue'] }, scheduledAt: { [Op.lt]: now } },
        include: [{ model: Lead, as: 'lead', attributes: ['id', 'name', 'phone'], required: false }],
        order: [['scheduledAt', 'ASC']], limit: 10,
      }),
      Followup.findAll({
        where: { ...fupWhere, status: 'pending', scheduledAt: { [Op.between]: [startOfTodayIST(), endOfTodayIST()] } },
        include: [{ model: Lead, as: 'lead', attributes: ['id', 'name', 'phone'], required: false }],
        order: [['scheduledAt', 'ASC']], limit: 10,
      }),
      Followup.count({
        where: { ...fupWhere, status: 'completed', completedAt: { [Op.between]: [startOfTodayIST(), endOfTodayIST()] } },
      }),
      Lead.count({ where: { ...leadWhere, status: { [Op.notIn]: ['Won', 'Lost'] } } }),
      Lead.count({ where: { ...leadWhere, status: 'New' } }),
      // Leads converted (Won) today
      Lead.findAll({
        where: { ...leadWhere, status: 'Won', updatedAt: { [Op.between]: [startOfTodayIST(), endOfTodayIST()] } },
        attributes: ['id', 'name', 'updatedAt'],
        order: [['updatedAt', 'DESC']], limit: 10,
      }),
      Quotation.count({ where: { ...quotWhere, status: { [Op.in]: ['Draft', 'Sent'] } } }),
      ContentTask.count({ where: { ...contentWhere, status: { [Op.in]: ['Pending', 'In Progress', 'Review'] } } }),
      Appointment.findAll({
        where: { ...apptWhere, startTime: { [Op.between]: [startOfTodayIST(), endOfTodayIST()] } },
        include: [{ model: Lead, as: 'lead', attributes: ['id', 'name'], required: false }],
        order: [['startTime', 'ASC']], limit: 5,
      }),
    ]);

    res.json({
      success: true,
      summary: {
        overdueFollowups, todayFollowups, completedFollowupsToday,
        activeLeads, newLeads, convertedToday,
        pendingQuotations, pendingContent,
        todayAppointments,
      },
    });
  } catch (err) {
    console.error('getLoginSummary error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch summary' });
  }
};

const getDashboard = async (req, res) => {
  try {
    const { user, workspaceId } = req;
    const orgId = user.organizationId;
    const now = new Date();
    const isEmployee = user.role === 'employee';
    const leadWhere = { organizationId: orgId, workspaceId, ...(isEmployee ? { assignedTo: user.id } : {}) };

    const [
      totalLeads, activeLeads, wonLeads, hotLeads,
      totalRevenue, pendingRevenue, overdueInvoices,
      pendingFollowups, overdueFollowups, todayAppts,
      recentLeads,
    ] = await Promise.all([
      Lead.count({ where: leadWhere }),
      Lead.count({ where: { ...leadWhere, status: { [Op.notIn]: ['Won', 'Lost'] } } }),
      Lead.count({ where: { ...leadWhere, status: 'Won' } }),
      Lead.count({ where: { ...leadWhere, isHot: true } }),
      Payment.sum('amount', { where: { organizationId: orgId, workspaceId } }),
      Invoice.sum('dueAmount', { where: { organizationId: orgId, workspaceId, status: { [Op.in]: ['Unpaid', 'Partial'] } } }),
      Invoice.count({ where: { organizationId: orgId, workspaceId, status: 'Overdue' } }),
      Followup.count({ where: { organizationId: orgId, workspaceId, status: 'pending', scheduledAt: { [Op.gte]: now } } }),
      Followup.count({ where: { organizationId: orgId, workspaceId, status: { [Op.in]: ['pending', 'overdue'] }, scheduledAt: { [Op.lt]: now } } }),
      Appointment.count({ where: { organizationId: orgId, workspaceId, startTime: { [Op.between]: [startOfTodayIST(), endOfTodayIST()] }, status: 'Scheduled' } }),
      Lead.findAll({ where: leadWhere, order: [['createdAt', 'DESC']], limit: 5, attributes: ['id', 'name', 'status', 'priority', 'source', 'createdAt'] }),
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
      where: leadWhere,
      attributes: ['status', [fn('COUNT', col('id')), 'count']],
      group: ['status'], raw: true,
    });

    const leadBySource = await Lead.findAll({
      where: leadWhere,
      attributes: ['source', [fn('COUNT', col('id')), 'count']],
      group: ['source'], raw: true,
    });

    const since6mo = new Date(); since6mo.setMonth(since6mo.getMonth() - 6);
    const leadVolume = await Lead.findAll({
      where: { ...leadWhere, createdAt: { [Op.gte]: since6mo } },
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
    const { startDate, endDate } = req.query;
    const dateFilter = {};
    if (startDate) dateFilter[Op.gte] = new Date(startDate);
    if (endDate) dateFilter[Op.lte] = new Date(endDate);
    const hasDateFilter = Object.keys(dateFilter).length > 0;

    const leadWhere = { organizationId: orgId, workspaceId };
    if (hasDateFilter) leadWhere.createdAt = dateFilter;

    const paymentWhere = { organizationId: orgId, workspaceId, ...(hasDateFilter ? { receivedAt: dateFilter } : {}) };
    const contentWhere = { organizationId: orgId, workspaceId, ...(hasDateFilter ? { createdAt: dateFilter } : {}) };

    const [leadBySource, agentPerformance, contentStats, revenueByMonth, totalRevenueRow, invoiceStats, pendingRow] = await Promise.all([
      Lead.findAll({
        where: leadWhere,
        attributes: ['source', [fn('COUNT', col('id')), 'count']],
        group: ['source'], raw: true,
      }),
      User.findAll({
        where: { workspaceId, organizationId: orgId, role: { [Op.in]: ['employee', 'admin'] }, isActive: true },
        attributes: ['id', 'name', 'email', 'label', 'role'],
        include: [{
          model: Lead, as: 'assignedLeads',
          attributes: ['status'],
          required: false,
          where: hasDateFilter ? { createdAt: dateFilter } : undefined,
        }],
      }),
      ContentTask.findAll({
        where: contentWhere,
        attributes: ['status', [fn('COUNT', col('id')), 'count']],
        group: ['status'], raw: true,
      }),
      Payment.findAll({
        where: paymentWhere,
        attributes: [[fn('YEAR', col('receivedAt')), 'year'], [fn('MONTH', col('receivedAt')), 'month'], [fn('SUM', col('amount')), 'total']],
        group: [fn('YEAR', col('receivedAt')), fn('MONTH', col('receivedAt'))],
        order: [[fn('YEAR', col('receivedAt')), 'ASC'], [fn('MONTH', col('receivedAt')), 'ASC']],
        raw: true,
      }),
      Payment.findOne({
        where: paymentWhere,
        attributes: [[fn('SUM', col('amount')), 'total']],
        raw: true,
      }),
      Invoice.findAll({
        where: { organizationId: orgId, workspaceId, ...(hasDateFilter ? { createdAt: dateFilter } : {}) },
        attributes: ['status', 'dueAmount', [fn('COUNT', col('id')), 'count']],
        group: ['status'], raw: true,
      }),
      Invoice.findOne({
        where: { organizationId: orgId, workspaceId, status: { [Op.in]: ['Unpaid', 'Partial'] }, ...(hasDateFilter ? { createdAt: dateFilter } : {}) },
        attributes: [[fn('SUM', col('dueAmount')), 'total']],
        raw: true,
      }),
    ]);

    const agentStats = agentPerformance.map((agent) => {
      const leads = agent.assignedLeads || [];
      const total = leads.length;
      const won = leads.filter((l) => l.status === 'Won').length;
      const lost = leads.filter((l) => l.status === 'Lost').length;
      const active = leads.filter((l) => !['Won', 'Lost'].includes(l.status)).length;
      return {
        agentName: agent.name,
        agentEmail: agent.email,
        label: agent.label || agent.role,
        totalLeads: total,
        wonLeads: won,
        lostLeads: lost,
        activeLeads: active,
        conversionRate: total > 0 ? Math.round((won / total) * 100) : 0,
      };
    });

    const totalInvoices = invoiceStats.reduce((s, r) => s + parseInt(r.count || 0), 0);
    const paidInvoices = invoiceStats.find((r) => r.status === 'Paid');

    res.json({
      success: true,
      leadBySource,
      revenueByMonth,
      agentStats,
      contentStats,
      totalRevenue: parseFloat(totalRevenueRow?.total || 0),
      totalInvoices,
      paidInvoices: parseInt(paidInvoices?.count || 0),
      pendingAmount: parseFloat(pendingRow?.total || 0),
    });
  } catch (err) {
    console.error('getAdvancedReports error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch reports' });
  }
};

module.exports = { getDashboard, getAdvancedReports, getLoginSummary };
