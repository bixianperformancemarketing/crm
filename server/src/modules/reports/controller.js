const { Op, fn, col } = require('sequelize');
const { Lead, Payment, Invoice, Followup, Appointment, ContentTask, User, Quotation } = require('../../config/models');
const { startOfTodayIST, endOfTodayIST } = require('../../utils/helpers');

const getLoginSummary = async (req, res) => {
  try {
    const { user, workspaceId } = req;
    const orgId = user.organizationId;
    const now = new Date();
    const isEmployee = user.role === 'employee';
    const ws = workspaceId ? { workspaceId } : {};

    const leadWhere    = { organizationId: orgId, ...ws, ...(isEmployee ? { assignedTo: user.id } : {}) };
    const fupWhere     = { organizationId: orgId, ...ws, ...(isEmployee ? { userId: user.id } : {}) };
    const quotWhere    = { organizationId: orgId, ...ws, ...(isEmployee ? { createdBy: user.id } : {}) };
    const contentWhere = { organizationId: orgId, ...ws, ...(isEmployee ? { assignedTo: user.id } : {}) };
    const apptWhere    = { organizationId: orgId, ...ws, ...(isEmployee ? { assignedTo: user.id } : {}), status: 'Scheduled' };

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
    const ws = workspaceId ? { workspaceId } : {};
    const leadWhere = { organizationId: orgId, ...ws, ...(isEmployee ? { assignedTo: user.id } : {}) };
    const baseWhere = { organizationId: orgId, ...ws };

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
      Payment.sum('amount', { where: baseWhere }),
      Invoice.sum('dueAmount', { where: { ...baseWhere, status: { [Op.in]: ['Unpaid', 'Partial'] } } }),
      Invoice.count({ where: { ...baseWhere, status: 'Overdue' } }),
      Followup.count({ where: { ...baseWhere, status: 'pending', scheduledAt: { [Op.gte]: now } } }),
      Followup.count({ where: { ...baseWhere, status: { [Op.in]: ['pending', 'overdue'] }, scheduledAt: { [Op.lt]: now } } }),
      Appointment.count({ where: { ...baseWhere, startTime: { [Op.between]: [startOfTodayIST(), endOfTodayIST()] }, status: 'Scheduled' } }),
      Lead.findAll({ where: leadWhere, order: [['createdAt', 'DESC']], limit: 5, attributes: ['id', 'name', 'status', 'priority', 'source', 'createdAt'] }),
    ]);

    const conversionRate = totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0;
    const wonInvoices = await Invoice.findAll({ where: { ...baseWhere, status: 'Paid' } });
    const avgDealSize = wonInvoices.length ? wonInvoices.reduce((s, i) => s + parseFloat(i.totalAmount), 0) / wonInvoices.length : 0;

    const since12mo = new Date(); since12mo.setMonth(since12mo.getMonth() - 12);
    const monthlyRevenue = await Payment.findAll({
      where: { ...baseWhere, receivedAt: { [Op.gte]: since12mo } },
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
      where: { ...baseWhere, status: 'pending', scheduledAt: { [Op.between]: [startOfTodayIST(), endOfTodayIST()] } },
      include: [{ model: Lead, as: 'lead', attributes: ['id', 'name', 'phone'], required: false }],
      order: [['scheduledAt', 'ASC']], limit: 10,
    });

    const todayAppointments = await Appointment.findAll({
      where: { ...baseWhere, startTime: { [Op.between]: [startOfTodayIST(), endOfTodayIST()] }, status: 'Scheduled' },
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
    if (endDate) { const d = new Date(endDate); d.setDate(d.getDate() + 1); dateFilter[Op.lt] = d; }
    const hasDateFilter = !!(startDate || endDate);
    const ws = workspaceId ? { workspaceId } : {};

    const leadWhere    = { organizationId: orgId, ...ws, ...(hasDateFilter ? { createdAt: dateFilter } : {}) };
    const paymentWhere = { organizationId: orgId, ...ws, ...(hasDateFilter ? { receivedAt: dateFilter } : {}) };
    const contentWhere = { organizationId: orgId, ...ws, ...(hasDateFilter ? { createdAt: dateFilter } : {}) };

    const quotationWhere  = { organizationId: orgId, ...ws, ...(hasDateFilter ? { createdAt: dateFilter } : {}) };
    const appointmentWhere = { organizationId: orgId, ...ws, ...(hasDateFilter ? { startTime: dateFilter } : {}) };
    const followupWhere   = { organizationId: orgId, ...ws, ...(hasDateFilter ? { scheduledAt: dateFilter } : {}) };

    const [leadBySource, agentPerformance, contentStats, revenueByMonth, totalRevenue, invoiceStats, pendingAmount] = await Promise.all([
      Lead.findAll({
        where: leadWhere,
        attributes: ['source', [fn('COUNT', col('id')), 'count']],
        group: ['source'], raw: true,
      }),
      User.findAll({
        where: { ...ws, organizationId: orgId, role: { [Op.in]: ['employee', 'admin'] }, isActive: true },
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
      Payment.sum('amount', { where: paymentWhere }),
      Invoice.findAll({
        where: { organizationId: orgId, ...ws, ...(hasDateFilter ? { createdAt: dateFilter } : {}) },
        attributes: ['status', [fn('COUNT', col('id')), 'count']],
        group: ['status'], raw: true,
      }),
      Invoice.sum('dueAmount', { where: { organizationId: orgId, ...ws, status: { [Op.in]: ['Unpaid', 'Partial'] }, ...(hasDateFilter ? { createdAt: dateFilter } : {}) } }),
    ]);

    const [quotationByStatus, quotationTotalValue, quotationApprovedValue, appointmentByStatus, appointmentByType, followupByStatus, followupByAgentRaw, paymentByMode, paymentByAgentRaw] = await Promise.all([
      Quotation.findAll({ where: quotationWhere, attributes: ['status', [fn('COUNT', col('id')), 'count']], group: ['status'], raw: true }),
      Quotation.sum('totalAmount', { where: quotationWhere }),
      Quotation.sum('totalAmount', { where: { ...quotationWhere, status: 'Approved' } }),
      Appointment.findAll({ where: appointmentWhere, attributes: ['status', [fn('COUNT', col('id')), 'count']], group: ['status'], raw: true }),
      Appointment.findAll({ where: appointmentWhere, attributes: ['type', [fn('COUNT', col('id')), 'count']], group: ['type'], raw: true }),
      Followup.findAll({ where: followupWhere, attributes: ['status', [fn('COUNT', col('id')), 'count']], group: ['status'], raw: true }),
      Followup.findAll({ where: followupWhere, attributes: ['userId', 'status', [fn('COUNT', col('id')), 'count']], group: ['userId', 'status'], raw: true }),
      Payment.findAll({ where: paymentWhere, attributes: ['mode', [fn('COUNT', col('id')), 'count'], [fn('SUM', col('amount')), 'total']], group: ['mode'], raw: true }),
      Payment.findAll({ where: paymentWhere, attributes: ['receivedBy', [fn('COUNT', col('id')), 'count'], [fn('SUM', col('amount')), 'total']], group: ['receivedBy'], raw: true }),
    ]);

    // Resolve agent names for followup and payment per-agent stats
    const agentIdSet = [...new Set([
      ...followupByAgentRaw.map(f => f.userId),
      ...paymentByAgentRaw.map(p => p.receivedBy),
    ].filter(Boolean))];
    const agentUserMap = {};
    if (agentIdSet.length > 0) {
      const agentUsers = await User.findAll({ where: { id: { [Op.in]: agentIdSet }, organizationId: orgId }, attributes: ['id', 'name', 'email', 'label', 'role'], raw: true });
      agentUsers.forEach(u => { agentUserMap[u.id] = u; });
    }

    const fupAgentMap = {};
    followupByAgentRaw.forEach(f => {
      if (!fupAgentMap[f.userId]) fupAgentMap[f.userId] = { total: 0, completed: 0, overdue: 0, pending: 0 };
      const cnt = parseInt(f.count || 0);
      fupAgentMap[f.userId].total += cnt;
      if (f.status === 'completed') fupAgentMap[f.userId].completed += cnt;
      else if (f.status === 'overdue') fupAgentMap[f.userId].overdue += cnt;
      else if (f.status === 'pending') fupAgentMap[f.userId].pending += cnt;
    });
    const followupAgentStats = Object.keys(fupAgentMap).map(uid => {
      const d = fupAgentMap[uid]; const u = agentUserMap[uid] || {};
      return { agentId: parseInt(uid), agentName: u.name || 'Unknown', agentEmail: u.email || '', label: u.label || u.role || 'Agent', total: d.total, completed: d.completed, overdue: d.overdue, pending: d.pending, completionRate: d.total > 0 ? Math.round((d.completed / d.total) * 100) : 0 };
    }).sort((a, b) => b.total - a.total);

    const paymentAgentStats = paymentByAgentRaw.map(p => {
      const u = agentUserMap[p.receivedBy] || {};
      return { agentId: p.receivedBy, agentName: u.name || 'Unknown', agentEmail: u.email || '', label: u.label || u.role || 'Agent', count: parseInt(p.count || 0), total: parseFloat(p.total || 0) };
    }).sort((a, b) => b.total - a.total);

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
      totalRevenue: parseFloat(totalRevenue || 0),
      totalInvoices,
      paidInvoices: parseInt(paidInvoices?.count || 0),
      pendingAmount: parseFloat(pendingAmount || 0),
      quotationByStatus,
      quotationTotalValue: parseFloat(quotationTotalValue || 0),
      quotationApprovedValue: parseFloat(quotationApprovedValue || 0),
      appointmentByStatus,
      appointmentByType,
      followupByStatus,
      followupAgentStats,
      paymentByMode,
      paymentAgentStats,
    });
  } catch (err) {
    console.error('getAdvancedReports error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch reports' });
  }
};

module.exports = { getDashboard, getAdvancedReports, getLoginSummary };
