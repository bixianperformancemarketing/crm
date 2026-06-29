const { Op, fn, col } = require('sequelize');
const { User, Lead, LeadActivity, ContentTask, Workspace, Payment, Invoice, Followup, Appointment } = require('../../config/models');
const { paginate, paginateResponse, startOfTodayIST, endOfTodayIST } = require('../../utils/helpers');

const getTeamSummary = async (req, res) => {
  try {
    const { user, workspaceId } = req;
    const orgId = user.organizationId;
    const ws = workspaceId ? { workspaceId } : {};

    const employees = await User.findAll({
      where: { organizationId: orgId, role: { [Op.in]: ['employee', 'admin'] }, isActive: true, workspaceId: workspaceId ? workspaceId : { [Op.ne]: null } },
      attributes: ['id', 'name', 'email', 'label', 'role', 'workspaceId', 'canAccessLeads', 'canUseContentCalendar'],
      include: [{ model: Workspace, as: 'workspace', attributes: ['id', 'name'], required: false }],
    });

    if (!employees.length) return res.json({ success: true, summary: [] });

    const employeeIds = employees.map(e => e.id);

    const leadEmpIds = employees
      .filter(e => e.role !== 'employee' || e.canAccessLeads !== false)
      .map(e => e.id);
    const taskEmpIds = employees
      .filter(e => e.role !== 'employee' || !!e.canUseContentCalendar)
      .map(e => e.id);

    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const [todayActions, activeLeads, wonLeads, pendingTasks, lastActivity] = await Promise.all([
      LeadActivity.findAll({
        where: { organizationId: orgId, ...ws, type: { [Op.ne]: 'viewed' }, userId: { [Op.in]: employeeIds }, createdAt: { [Op.between]: [startOfTodayIST(), endOfTodayIST()] } },
        attributes: ['userId', [fn('COUNT', col('id')), 'count']],
        group: ['userId'], raw: true,
      }),
      leadEmpIds.length ? Lead.findAll({
        where: { organizationId: orgId, ...ws, status: { [Op.notIn]: ['Won', 'Lost'] }, assignedTo: { [Op.in]: leadEmpIds } },
        attributes: ['assignedTo', [fn('COUNT', col('id')), 'count']],
        group: ['assignedTo'], raw: true,
      }) : Promise.resolve([]),
      leadEmpIds.length ? Lead.findAll({
        where: { organizationId: orgId, ...ws, status: 'Won', assignedTo: { [Op.in]: leadEmpIds }, updatedAt: { [Op.gte]: monthStart } },
        attributes: ['assignedTo', [fn('COUNT', col('id')), 'count']],
        group: ['assignedTo'], raw: true,
      }) : Promise.resolve([]),
      taskEmpIds.length ? ContentTask.findAll({
        where: { organizationId: orgId, ...ws, status: { [Op.in]: ['Pending', 'In Progress', 'Review'] }, assignedTo: { [Op.in]: taskEmpIds } },
        attributes: ['assignedTo', [fn('COUNT', col('id')), 'count']],
        group: ['assignedTo'], raw: true,
      }) : Promise.resolve([]),
      LeadActivity.findAll({
        where: { organizationId: orgId, ...ws, type: { [Op.ne]: 'viewed' }, userId: { [Op.in]: employeeIds } },
        attributes: ['userId', [fn('MAX', col('createdAt')), 'lastAt']],
        group: ['userId'], raw: true,
      }),
    ]);

    const toMap = (arr, key) => arr.reduce((m, r) => { m[r[key]] = parseInt(r.count || 0); return m; }, {});
    const todayMap = toMap(todayActions, 'userId');
    const activeMap = toMap(activeLeads, 'assignedTo');
    const wonMap = toMap(wonLeads, 'assignedTo');
    const taskMap = toMap(pendingTasks, 'assignedTo');
    const lastMap = lastActivity.reduce((m, r) => { m[r.userId] = r.lastAt; return m; }, {});

    const summary = employees.map(e => {
      const isEmpRole = e.role === 'employee';
      const empCanAccessLeads = !isEmpRole || e.canAccessLeads !== false;
      const empCanUseTasks = !isEmpRole || !!e.canUseContentCalendar;
      return {
        id: e.id,
        name: e.name,
        email: e.email,
        label: e.label || e.role,
        role: e.role,
        workspace: e.workspace ? e.workspace.name : null,
        canAccessLeads: empCanAccessLeads,
        canUseTasks: empCanUseTasks,
        todayActions: todayMap[e.id] || 0,
        activeLeads: empCanAccessLeads ? (activeMap[e.id] || 0) : null,
        wonThisMonth: empCanAccessLeads ? (wonMap[e.id] || 0) : null,
        pendingTasks: empCanUseTasks ? (taskMap[e.id] || 0) : null,
        lastActivityAt: lastMap[e.id] || null,
      };
    }).sort((a, b) => b.todayActions - a.todayActions);

    res.json({ success: true, summary });
  } catch (err) {
    console.error('getTeamSummary error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch team summary' });
  }
};

const getTeamFeed = async (req, res) => {
  try {
    const { user, workspaceId } = req;
    const orgId = user.organizationId;
    const { page = 1, limit = 30, userId, type, dateFrom, dateTo } = req.query;
    const { limit: lim, offset } = paginate(page, limit);
    const ws = workspaceId ? { workspaceId } : {};

    const where = { organizationId: orgId, ...ws, type: { [Op.ne]: 'viewed' } };
    if (userId) where.userId = userId;
    if (type) where.type = type;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt[Op.gte] = new Date(dateFrom);
      if (dateTo) { const d = new Date(dateTo); d.setDate(d.getDate() + 1); where.createdAt[Op.lt] = d; }
    }

    const userWhere = { isActive: true };
    if (workspaceId) userWhere.workspaceId = workspaceId;

    const { count, rows } = await LeadActivity.findAndCountAll({
      where,
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'label', 'role'], required: true, where: userWhere },
        { model: Lead, as: 'lead', attributes: ['id', 'name', 'status'], required: false },
      ],
      order: [['createdAt', 'DESC']],
      limit: lim,
      offset,
    });

    res.json({ success: true, ...paginateResponse(rows, count, page, lim) });
  } catch (err) {
    console.error('getTeamFeed error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch team feed' });
  }
};

const getEmployeeStats = async (req, res) => {
  try {
    const { user, workspaceId } = req;
    const { userId } = req.params;
    const orgId = user.organizationId;
    const now = new Date();
    const ws = workspaceId ? { workspaceId } : {};

    const employee = await User.findOne({
      where: { id: userId, organizationId: orgId, isActive: true },
      attributes: ['id', 'name', 'email', 'label', 'role', 'workspaceId', 'canAccessLeads', 'canUseContentCalendar'],
    });
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

    const isEmpRole = employee.role === 'employee';
    const empCanAccessLeads = !isEmpRole || employee.canAccessLeads !== false;
    const empCanUseTasks = !isEmpRole || !!employee.canUseContentCalendar;

    // Use the employee's own workspaceId so stats match exactly what they see on their dashboard
    const empWs = employee.workspaceId ? { workspaceId: employee.workspaceId } : {};
    const baseWhere = { organizationId: orgId, ...empWs };
    const leadWhere = { ...baseWhere, assignedTo: userId };
    const taskWhere = { ...baseWhere, assignedTo: userId };

    const zero = Promise.resolve(0);

    // Scope payment and invoice queries to only this employee's leads (only if they have lead access)
    let empLeadIds = [];
    if (empCanAccessLeads) {
      const empLeads = await Lead.findAll({ where: leadWhere, attributes: ['id'], raw: true });
      empLeadIds = empLeads.map(l => l.id);
    }
    const leadIdScope = empLeadIds.length ? { leadId: { [Op.in]: empLeadIds } } : { leadId: { [Op.in]: [-1] } };

    const [
      totalLeads, activeLeads, wonLeads, hotLeads,
      totalRevenue, pendingRevenue, overdueInvoices,
      pendingFollowups, overdueFollowups, todayAppts,
      totalTasks, overdueTasks, inProgressTasks, pendingTaskCount, reviewTasks,
    ] = await Promise.all([
      empCanAccessLeads ? Lead.count({ where: leadWhere }) : zero,
      empCanAccessLeads ? Lead.count({ where: { ...leadWhere, status: { [Op.notIn]: ['Won', 'Lost'] } } }) : zero,
      empCanAccessLeads ? Lead.count({ where: { ...leadWhere, status: 'Won' } }) : zero,
      empCanAccessLeads ? Lead.count({ where: { ...leadWhere, isHot: true } }) : zero,
      empCanAccessLeads ? Payment.sum('amount', { where: { ...baseWhere, ...leadIdScope } }) : zero,
      empCanAccessLeads ? Invoice.sum('dueAmount', { where: { ...baseWhere, ...leadIdScope, status: { [Op.in]: ['Unpaid', 'Partial'] } } }) : zero,
      empCanAccessLeads ? Invoice.count({ where: { ...baseWhere, ...leadIdScope, status: 'Overdue' } }) : zero,
      empCanAccessLeads ? Followup.count({ where: { ...baseWhere, userId, status: 'pending', scheduledAt: { [Op.gte]: now } } }) : zero,
      empCanAccessLeads ? Followup.count({ where: { ...baseWhere, userId, status: { [Op.in]: ['pending', 'overdue'] }, scheduledAt: { [Op.lt]: now } } }) : zero,
      empCanAccessLeads ? Appointment.count({ where: { ...baseWhere, assignedTo: userId, startTime: { [Op.between]: [startOfTodayIST(), endOfTodayIST()] }, status: 'Scheduled' } }) : zero,
      empCanUseTasks ? ContentTask.count({ where: taskWhere }) : zero,
      empCanUseTasks ? ContentTask.count({ where: { ...taskWhere, status: 'Overdue' } }) : zero,
      empCanUseTasks ? ContentTask.count({ where: { ...taskWhere, status: 'In Progress' } }) : zero,
      empCanUseTasks ? ContentTask.count({ where: { ...taskWhere, status: { [Op.in]: ['Pending', 'To Do Today'] } } }) : zero,
      empCanUseTasks ? ContentTask.count({ where: { ...taskWhere, status: 'Review' } }) : zero,
    ]);

    let avgDealSize = 0;
    let conversionRate = 0;
    if (empCanAccessLeads) {
      const wonInvoices = await Invoice.findAll({ where: { ...baseWhere, ...leadIdScope, status: 'Paid' }, attributes: ['totalAmount'], raw: true });
      avgDealSize = wonInvoices.length
        ? wonInvoices.reduce((s, i) => s + parseFloat(i.totalAmount), 0) / wonInvoices.length
        : 0;
      conversionRate = totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0;
    }

    res.json({
      success: true,
      employee: { id: employee.id, name: employee.name, label: employee.label || employee.role },
      canAccessLeads: empCanAccessLeads,
      canUseTasks: empCanUseTasks,
      stats: {
        ...(empCanAccessLeads ? {
          totalLeads, activeLeads, wonLeads, hotLeads,
          totalRevenue: parseFloat(totalRevenue) || 0,
          pendingRevenue: parseFloat(pendingRevenue) || 0,
          overdueInvoices, pendingFollowups, overdueFollowups, todayAppts,
          conversionRate, avgDealSize: Math.round(avgDealSize),
        } : {}),
        ...(empCanUseTasks ? {
          totalTasks, overdueTasks, inProgressTasks, pendingTaskCount, reviewTasks,
        } : {}),
      },
    });
  } catch (err) {
    console.error('getEmployeeStats error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch employee stats' });
  }
};

module.exports = { getTeamSummary, getTeamFeed, getEmployeeStats };
