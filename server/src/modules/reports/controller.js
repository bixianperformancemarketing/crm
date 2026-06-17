const { Op, fn, col, literal } = require('sequelize');
const moment = require('moment-timezone');
const { Lead, Payment, Invoice, Followup, Appointment, ContentTask, User, Quotation } = require('../../config/models');
const { startOfTodayIST, endOfTodayIST } = require('../../utils/helpers');

const getLoginSummary = async (req, res) => {
  try {
    const { user, workspaceId } = req;
    const orgId = user.organizationId;
    const now = new Date();
    const isEmployee = user.role === 'employee';
    const ws = workspaceId ? { workspaceId } : {};
    const canAccessLeads = !isEmployee || user.canAccessLeads !== false;
    const canUseTasks = !isEmployee || !!user.canUseContentCalendar;

    const monthStart = moment().tz('Asia/Kolkata').startOf('month').toDate();
    const monthEnd   = moment().tz('Asia/Kolkata').endOf('day').toDate();

    const leadWhere    = { organizationId: orgId, ...ws, ...(isEmployee ? { assignedTo: user.id } : {}) };
    const fupWhere     = { organizationId: orgId, ...ws, ...(isEmployee ? { userId: user.id } : {}) };
    const quotWhere    = { organizationId: orgId, ...ws, ...(isEmployee ? { createdBy: user.id } : {}) };
    const contentWhere = { organizationId: orgId, ...ws, ...(isEmployee ? { assignedTo: user.id } : {}), isArchived: { [Op.ne]: true } };
    const apptWhere    = { organizationId: orgId, ...ws, ...(isEmployee ? { assignedTo: user.id } : {}), status: 'Scheduled' };

    const zero = Promise.resolve(0);
    const emptyArr = Promise.resolve([]);

    const [
      overdueFollowups,
      todayFollowups,
      completedFollowupsToday,
      activeLeads,
      newLeads,
      convertedToday,
      pendingQuotations,
      todayAppointments,
      totalTasks,
      overviewTasks,
      todoTodayTasks,
      inProgressTasks,
      reviewTasks,
      approvedTasks,
      notApprovedTasks,
      doneTasks,
      cancelledTasks,
    ] = await Promise.all([
      canAccessLeads ? Followup.findAll({
        where: { ...fupWhere, status: { [Op.in]: ['pending', 'overdue'] }, scheduledAt: { [Op.lt]: now } },
        include: [{ model: Lead, as: 'lead', attributes: ['id', 'name', 'phone'], required: false }],
        order: [['scheduledAt', 'ASC']], limit: 10,
      }) : emptyArr,
      canAccessLeads ? Followup.findAll({
        where: { ...fupWhere, status: 'pending', scheduledAt: { [Op.between]: [startOfTodayIST(), endOfTodayIST()] } },
        include: [{ model: Lead, as: 'lead', attributes: ['id', 'name', 'phone'], required: false }],
        order: [['scheduledAt', 'ASC']], limit: 10,
      }) : emptyArr,
      canAccessLeads ? Followup.count({
        where: { ...fupWhere, status: 'completed', completedAt: { [Op.between]: [startOfTodayIST(), endOfTodayIST()] } },
      }) : zero,
      canAccessLeads ? Lead.count({ where: { ...leadWhere, status: { [Op.notIn]: ['Won', 'Lost'] } } }) : zero,
      canAccessLeads ? Lead.count({ where: { ...leadWhere, createdAt: { [Op.between]: [monthStart, monthEnd] } } }) : zero,
      canAccessLeads ? Lead.findAll({
        where: { ...leadWhere, status: 'Won', updatedAt: { [Op.between]: [monthStart, monthEnd] } },
        attributes: ['id', 'name', 'updatedAt'],
        order: [['updatedAt', 'DESC']], limit: 50,
      }) : emptyArr,
      canAccessLeads ? Quotation.count({ where: { ...quotWhere, status: { [Op.in]: ['Draft', 'Sent'] } } }) : zero,
      canAccessLeads ? Appointment.findAll({
        where: { ...apptWhere, startTime: { [Op.between]: [startOfTodayIST(), endOfTodayIST()] } },
        include: [{ model: Lead, as: 'lead', attributes: ['id', 'name'], required: false }],
        order: [['startTime', 'ASC']], limit: 5,
      }) : emptyArr,
      canUseTasks ? ContentTask.count({ where: contentWhere }) : zero,
      canUseTasks ? ContentTask.count({ where: { ...contentWhere, status: 'Overdue' } }) : zero,
      canUseTasks ? ContentTask.count({ where: { ...contentWhere, status: 'To Do Today' } }) : zero,
      canUseTasks ? ContentTask.count({ where: { ...contentWhere, status: 'In Progress' } }) : zero,
      canUseTasks ? ContentTask.count({ where: { ...contentWhere, status: 'Review' } }) : zero,
      canUseTasks ? ContentTask.count({ where: { ...contentWhere, status: 'Approved' } }) : zero,
      canUseTasks ? ContentTask.count({ where: { ...contentWhere, status: 'Not Approved' } }) : zero,
      canUseTasks ? ContentTask.count({ where: { ...contentWhere, status: 'Done' } }) : zero,
      canUseTasks ? ContentTask.count({ where: { ...contentWhere, status: 'Cancelled' } }) : zero,
    ]);

    res.json({
      success: true,
      summary: {
        overdueFollowups, todayFollowups, completedFollowupsToday,
        activeLeads, newLeads, convertedToday,
        pendingQuotations, todayAppointments,
        totalTasks, overviewTasks, todoTodayTasks, inProgressTasks, reviewTasks, approvedTasks, notApprovedTasks,
        doneTasks, cancelledTasks,
      },
    });
  } catch (err) {
    console.error('getLoginSummary error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch summary' });
  }
};

const getPeriodRange = (period) => {
  const now = moment().tz('Asia/Kolkata');
  switch (period) {
    case 'this_week':   return { start: now.clone().startOf('isoWeek').toDate(), end: now.clone().endOf('isoWeek').toDate() };
    case 'last_week':   return { start: now.clone().subtract(1, 'week').startOf('isoWeek').toDate(), end: now.clone().subtract(1, 'week').endOf('isoWeek').toDate() };
    case 'last_month':  return { start: now.clone().subtract(1, 'month').startOf('month').toDate(), end: now.clone().subtract(1, 'month').endOf('month').toDate() };
    case 'this_quarter': {
      const q = Math.floor(now.month() / 3);
      return { start: now.clone().month(q * 3).startOf('month').toDate(), end: now.clone().month(q * 3 + 2).endOf('month').toDate() };
    }
    case 'this_year':   return { start: now.clone().startOf('year').toDate(), end: now.clone().endOf('year').toDate() };
    case 'overall':     return null;
    default:            return { start: now.clone().startOf('month').toDate(), end: now.clone().endOf('month').toDate() };
  }
};

const getDashboard = async (req, res) => {
  try {
    const { user, workspaceId } = req;
    const orgId = user.organizationId;
    const now = new Date();
    const isEmployee = user.role === 'employee';
    const ws = workspaceId ? { workspaceId } : {};
    const canAccessLeads = !isEmployee || user.canAccessLeads !== false;
    const canUseTasks = !isEmployee || !!user.canUseContentCalendar;
    const { period = 'this_month', from, to } = req.query;
    const periodRange = (from && to)
      ? {
          start: moment.tz(from, 'YYYY-MM-DD', 'Asia/Kolkata').startOf('day').toDate(),
          end:   moment.tz(to,   'YYYY-MM-DD', 'Asia/Kolkata').endOf('day').toDate(),
        }
      : getPeriodRange(period);
    const periodFilter = periodRange ? { [Op.between]: [periodRange.start, periodRange.end] } : undefined;

    const baseWhere = { organizationId: orgId, ...ws };
    const taskWhere = { organizationId: orgId, ...ws, ...(isEmployee ? { assignedTo: user.id } : {}), ...(periodFilter ? { createdAt: periodFilter } : {}), isArchived: { [Op.ne]: true } };

    // For overdue followups, clamp the period end to now (past periods are entirely overdue; current period only counts the elapsed portion)
    const clampedEnd = periodRange ? new Date(Math.min(periodRange.end.getTime(), now.getTime())) : now;
    const followupScheduledAt = periodFilter ? periodFilter : { [Op.gte]: now };
    const overdueScheduledAt  = periodRange ? { [Op.between]: [periodRange.start, clampedEnd] } : { [Op.lt]: now };
    const apptTimeWhere       = periodFilter ? { startTime: periodFilter } : { startTime: { [Op.between]: [startOfTodayIST(), endOfTodayIST()] } };

    // For employees, pre-fetch their lead IDs so invoice/payment queries can be scoped correctly
    let employeeLeadIds = null;
    if (isEmployee && canAccessLeads) {
      const myLeads = await Lead.findAll({ where: { organizationId: orgId, ...ws, assignedTo: user.id }, attributes: ['id'], raw: true });
      employeeLeadIds = myLeads.map(l => l.id);
    }
    const leadIdScope = isEmployee && employeeLeadIds !== null
      ? { leadId: { [Op.in]: employeeLeadIds.length ? employeeLeadIds : [-1] } }
      : {};

    // leads created in period
    const leadWhere = { organizationId: orgId, ...ws, ...(isEmployee ? { assignedTo: user.id } : {}), ...(periodFilter ? { createdAt: periodFilter } : {}) };
    // leads won (marked Won) in period — use updatedAt so it reflects when they were closed
    const wonLeadWhere = { organizationId: orgId, ...ws, ...(isEmployee ? { assignedTo: user.id } : {}), status: 'Won', ...(periodFilter ? { updatedAt: periodFilter } : {}) };
    // payments received in period, scoped to employee's leads
    const paymentWhere = { organizationId: orgId, ...ws, ...leadIdScope, ...(periodFilter ? { receivedAt: periodFilter } : {}) };
    // invoices scoped to employee's leads — base (for overdue count, which is always current state)
    const invoiceWhere = { organizationId: orgId, ...ws, ...leadIdScope };
    // pending revenue: invoices created in the selected period that are still unpaid
    const pendingInvoiceWhere = { ...invoiceWhere, ...(periodFilter ? { createdAt: periodFilter } : {}) };
    // followups/appointments scoped to employee
    const followupWhere = { organizationId: orgId, ...ws, ...(isEmployee ? { userId: user.id } : {}) };
    const apptWhere = { organizationId: orgId, ...ws, ...(isEmployee ? { assignedTo: user.id } : {}), status: 'Scheduled' };

    const zero = Promise.resolve(0);
    const emptyArr = Promise.resolve([]);

    const [
      totalLeads, activeLeads, wonLeads, hotLeads,
      totalRevenue, pendingRevenue, overdueInvoices,
      pendingFollowups, overdueFollowups, todayAppts,
      recentLeads,
      totalTasks, overviewTasks, todoTodayTasks, inProgressTasks, reviewTasks, approvedTasks, notApprovedTasks,
      doneTasks, cancelledTasks,
    ] = await Promise.all([
      canAccessLeads ? Lead.count({ where: leadWhere }) : zero,
      canAccessLeads ? Lead.count({ where: { ...leadWhere, status: { [Op.notIn]: ['Won', 'Lost'] } } }) : zero,
      canAccessLeads ? Lead.count({ where: wonLeadWhere }) : zero,
      canAccessLeads ? Lead.count({ where: { ...leadWhere, isHot: true } }) : zero,
      canAccessLeads ? Payment.sum('amount', { where: paymentWhere }) : zero,
      canAccessLeads ? Invoice.sum('dueAmount', { where: { ...pendingInvoiceWhere, status: { [Op.in]: ['Unpaid', 'Partial'] } } }) : zero,
      canAccessLeads ? Invoice.count({ where: { ...pendingInvoiceWhere, status: 'Overdue' } }) : zero,
      canAccessLeads ? Followup.count({ where: { ...followupWhere, status: 'pending', scheduledAt: followupScheduledAt } }) : zero,
      canAccessLeads ? Followup.count({ where: { ...followupWhere, status: { [Op.in]: ['pending', 'overdue'] }, scheduledAt: overdueScheduledAt } }) : zero,
      canAccessLeads ? Appointment.count({ where: { ...apptWhere, ...apptTimeWhere } }) : zero,
      canAccessLeads ? Lead.findAll({ where: leadWhere, order: [['createdAt', 'DESC']], limit: 5, attributes: ['id', 'name', 'status', 'priority', 'source', 'createdAt'] }) : emptyArr,
      canUseTasks ? ContentTask.count({ where: taskWhere }) : zero,
      canUseTasks ? ContentTask.count({ where: { ...taskWhere, status: 'Overdue' } }) : zero,
      canUseTasks ? ContentTask.count({ where: { ...taskWhere, status: 'To Do Today' } }) : zero,
      canUseTasks ? ContentTask.count({ where: { ...taskWhere, status: 'In Progress' } }) : zero,
      canUseTasks ? ContentTask.count({ where: { ...taskWhere, status: 'Review' } }) : zero,
      canUseTasks ? ContentTask.count({ where: { ...taskWhere, status: 'Approved' } }) : zero,
      canUseTasks ? ContentTask.count({ where: { ...taskWhere, status: 'Not Approved' } }) : zero,
      canUseTasks ? ContentTask.count({ where: { ...taskWhere, status: 'Done' } }) : zero,
      canUseTasks ? ContentTask.count({ where: { ...taskWhere, status: 'Cancelled' } }) : zero,
    ]);

    const conversionRate = canAccessLeads && totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0;

    let avgDealSize = 0;
    let monthlyRevenue = [], leadByStatus = [], leadBySource = [], leadVolume = [];
    let todayFollowups = [], todayAppointments = [];

    if (canAccessLeads) {
      // avg deal size: paid invoices on employee's leads, within the period
      const wonInvoices = await Invoice.findAll({ where: { ...invoiceWhere, status: 'Paid', ...(periodFilter ? { updatedAt: periodFilter } : {}) } });
      avgDealSize = wonInvoices.length ? wonInvoices.reduce((s, i) => s + parseFloat(i.totalAmount), 0) / wonInvoices.length : 0;

      const since12mo = new Date(); since12mo.setMonth(since12mo.getMonth() - 12);
      const since6mo = new Date(); since6mo.setMonth(since6mo.getMonth() - 6);

      [monthlyRevenue, leadByStatus, leadBySource, leadVolume, todayFollowups, todayAppointments] = await Promise.all([
        Payment.findAll({
          where: { ...baseWhere, ...leadIdScope, receivedAt: { [Op.gte]: since12mo } },
          attributes: [[fn('YEAR', col('receivedAt')), 'year'], [fn('MONTH', col('receivedAt')), 'month'], [fn('SUM', col('amount')), 'total']],
          group: [fn('YEAR', col('receivedAt')), fn('MONTH', col('receivedAt'))],
          order: [[fn('YEAR', col('receivedAt')), 'ASC'], [fn('MONTH', col('receivedAt')), 'ASC']],
          raw: true,
        }),
        Lead.findAll({
          where: leadWhere,
          attributes: ['status', [fn('COUNT', col('id')), 'count']],
          group: ['status'], raw: true,
        }),
        Lead.findAll({
          where: leadWhere,
          attributes: ['source', [fn('COUNT', col('id')), 'count']],
          group: ['source'], raw: true,
        }),
        Lead.findAll({
          where: { ...leadWhere, createdAt: { [Op.gte]: since6mo } },
          attributes: [[fn('YEAR', col('createdAt')), 'year'], [fn('MONTH', col('createdAt')), 'month'], [fn('COUNT', col('id')), 'count']],
          group: [fn('YEAR', col('createdAt')), fn('MONTH', col('createdAt'))],
          order: [[fn('YEAR', col('createdAt')), 'ASC'], [fn('MONTH', col('createdAt')), 'ASC']],
          raw: true,
        }),
        Followup.findAll({
          where: { ...followupWhere, status: 'pending', scheduledAt: { [Op.between]: [startOfTodayIST(), endOfTodayIST()] } },
          include: [{ model: Lead, as: 'lead', attributes: ['id', 'name', 'phone'], required: false }],
          order: [['scheduledAt', 'ASC']], limit: 10,
        }),
        Appointment.findAll({
          where: { ...apptWhere, startTime: { [Op.between]: [startOfTodayIST(), endOfTodayIST()] } },
          include: [
            { model: Lead, as: 'lead', attributes: ['id', 'name'], required: false },
            { model: User, as: 'assignee', attributes: ['id', 'name'], required: false },
          ],
          order: [['startTime', 'ASC']], limit: 10,
        }),
      ]);
    }

    // Employee earnings: sum of the first invoice amount per lead (onboarding incentive).
    // Only the first invoice raised for each lead counts; repeat invoices are excluded.
    // Period filter applies to when that first invoice was created.
    let earnings = 0;
    if (isEmployee && canAccessLeads && employeeLeadIds !== null && employeeLeadIds.length) {
      // Step 1: find the earliest invoice ID per lead
      const firstByLead = await Invoice.findAll({
        where: { leadId: { [Op.in]: employeeLeadIds }, organizationId: orgId },
        attributes: ['leadId', [fn('MIN', col('id')), 'firstId']],
        group: ['leadId'],
        raw: true,
      });
      if (firstByLead.length) {
        const firstIds = firstByLead.map(r => r.firstId);
        // Step 2: fetch those first invoices, applying the period filter on createdAt
        const firstInvoices = await Invoice.findAll({
          where: {
            id: { [Op.in]: firstIds },
            organizationId: orgId,
            ...(periodFilter ? { createdAt: periodFilter } : {}),
          },
          attributes: ['paidAmount'],
          raw: true,
        });
        earnings = firstInvoices.reduce((s, i) => s + parseFloat(i.paidAmount || 0), 0);
      }
    }

    res.json({
      success: true,
      period,
      stats: {
        totalLeads, activeLeads, wonLeads, hotLeads,
        totalRevenue: parseFloat(totalRevenue) || 0,
        pendingRevenue: parseFloat(pendingRevenue) || 0,
        overdueInvoices, pendingFollowups, overdueFollowups, todayAppts,
        conversionRate, avgDealSize: Math.round(avgDealSize),
        totalTasks, overviewTasks, todoTodayTasks, inProgressTasks, reviewTasks, approvedTasks, notApprovedTasks,
        doneTasks, cancelledTasks,
        earnings,
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
