const { Op, fn, col } = require('sequelize');
const { User, Lead, LeadActivity, ContentTask, Workspace, Payment, Invoice, Followup, Appointment } = require('../../config/models');
const { paginate, paginateResponse, startOfTodayIST, endOfTodayIST } = require('../../utils/helpers');

const getTeamSummary = async (req, res) => {
  try {
    const { user, workspaceId } = req;
    const orgId = user.organizationId;
    const ws = workspaceId ? { workspaceId } : {};

    const employees = await User.findAll({
      where: { ...ws, organizationId: orgId, role: { [Op.in]: ['employee', 'admin'] }, isActive: true },
      attributes: ['id', 'name', 'email', 'label', 'role', 'workspaceId'],
      include: [{ model: Workspace, as: 'workspace', attributes: ['id', 'name'], required: false }],
    });

    if (!employees.length) return res.json({ success: true, summary: [] });

    const employeeIds = employees.map(e => e.id);
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const [todayActions, activeLeads, wonLeads, pendingTasks, lastActivity] = await Promise.all([
      LeadActivity.findAll({
        where: { organizationId: orgId, ...ws, type: { [Op.ne]: 'viewed' }, userId: { [Op.in]: employeeIds }, createdAt: { [Op.between]: [startOfTodayIST(), endOfTodayIST()] } },
        attributes: ['userId', [fn('COUNT', col('id')), 'count']],
        group: ['userId'], raw: true,
      }),
      Lead.findAll({
        where: { organizationId: orgId, ...ws, status: { [Op.notIn]: ['Won', 'Lost'] }, assignedTo: { [Op.in]: employeeIds } },
        attributes: ['assignedTo', [fn('COUNT', col('id')), 'count']],
        group: ['assignedTo'], raw: true,
      }),
      Lead.findAll({
        where: { organizationId: orgId, ...ws, status: 'Won', assignedTo: { [Op.in]: employeeIds }, updatedAt: { [Op.gte]: monthStart } },
        attributes: ['assignedTo', [fn('COUNT', col('id')), 'count']],
        group: ['assignedTo'], raw: true,
      }),
      ContentTask.findAll({
        where: { organizationId: orgId, ...ws, status: { [Op.in]: ['Pending', 'In Progress', 'Review'] }, assignedTo: { [Op.in]: employeeIds } },
        attributes: ['assignedTo', [fn('COUNT', col('id')), 'count']],
        group: ['assignedTo'], raw: true,
      }),
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

    const summary = employees.map(e => ({
      id: e.id,
      name: e.name,
      email: e.email,
      label: e.label || e.role,
      role: e.role,
      workspace: e.workspace ? e.workspace.name : null,
      todayActions: todayMap[e.id] || 0,
      activeLeads: activeMap[e.id] || 0,
      wonThisMonth: wonMap[e.id] || 0,
      pendingTasks: taskMap[e.id] || 0,
      lastActivityAt: lastMap[e.id] || null,
    })).sort((a, b) => b.todayActions - a.todayActions);

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

    const { count, rows } = await LeadActivity.findAndCountAll({
      where,
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'label', 'role'], required: false },
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
      where: { id: userId, organizationId: orgId },
      attributes: ['id', 'name', 'email', 'label', 'role'],
    });
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

    const leadWhere = { organizationId: orgId, ...ws, assignedTo: userId };

    const leadIds = await Lead.findAll({ where: leadWhere, attributes: ['id'], raw: true }).then(r => r.map(l => l.id));

    const invoiceWhere = leadIds.length ? { organizationId: orgId, leadId: { [Op.in]: leadIds } } : null;

    const [
      totalLeads, activeLeads, wonLeads, hotLeads,
      totalRevenue, pendingRevenue, overdueInvoices,
      pendingFollowups, overdueFollowups, todayAppts,
    ] = await Promise.all([
      Lead.count({ where: leadWhere }),
      Lead.count({ where: { ...leadWhere, status: { [Op.notIn]: ['Won', 'Lost'] } } }),
      Lead.count({ where: { ...leadWhere, status: 'Won' } }),
      Lead.count({ where: { ...leadWhere, isHot: true } }),
      invoiceWhere ? Payment.sum('amount', { where: { organizationId: orgId, leadId: { [Op.in]: leadIds } } }) : Promise.resolve(0),
      invoiceWhere ? Invoice.sum('dueAmount', { where: { ...invoiceWhere, status: { [Op.in]: ['Unpaid', 'Partial'] } } }) : Promise.resolve(0),
      invoiceWhere ? Invoice.count({ where: { ...invoiceWhere, status: 'Overdue' } }) : Promise.resolve(0),
      Followup.count({ where: { organizationId: orgId, ...ws, userId, status: 'pending', scheduledAt: { [Op.gte]: now } } }),
      Followup.count({ where: { organizationId: orgId, ...ws, userId, status: { [Op.in]: ['pending', 'overdue'] }, scheduledAt: { [Op.lt]: now } } }),
      Appointment.count({ where: { organizationId: orgId, ...ws, assignedTo: userId, startTime: { [Op.between]: [startOfTodayIST(), endOfTodayIST()] }, status: 'Scheduled' } }),
    ]);

    const wonInvoices = invoiceWhere
      ? await Invoice.findAll({ where: { ...invoiceWhere, status: 'Paid' }, attributes: ['totalAmount'], raw: true })
      : [];
    const avgDealSize = wonInvoices.length
      ? wonInvoices.reduce((s, i) => s + parseFloat(i.totalAmount), 0) / wonInvoices.length
      : 0;
    const conversionRate = totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0;

    res.json({
      success: true,
      employee: { id: employee.id, name: employee.name, label: employee.label || employee.role },
      stats: {
        totalLeads, activeLeads, wonLeads, hotLeads,
        totalRevenue: parseFloat(totalRevenue) || 0,
        pendingRevenue: parseFloat(pendingRevenue) || 0,
        overdueInvoices, pendingFollowups, overdueFollowups, todayAppts,
        conversionRate, avgDealSize: Math.round(avgDealSize),
      },
    });
  } catch (err) {
    console.error('getEmployeeStats error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch employee stats' });
  }
};

module.exports = { getTeamSummary, getTeamFeed, getEmployeeStats };
