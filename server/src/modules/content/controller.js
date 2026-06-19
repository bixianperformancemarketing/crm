const { Op } = require('sequelize');
const { ContentTask, User, Lead } = require('../../config/models');
const { paginate, paginateResponse } = require('../../utils/helpers');

const PIPELINE_COLUMNS = ['Overdue', 'To Do Today', 'In Progress', 'Done', 'Review', 'Approved', 'Not Approved'];
const COMPLETED_STATUSES = ['Done', 'Approved', 'Not Approved', 'Cancelled'];

const getTasks = async (req, res) => {
  try {
    const { user, workspaceId } = req;
    const { page = 1, limit = 20, status, assignedTo, dateFrom, dateTo, search, dueDateSort } = req.query;
    const { limit: lim, offset } = paginate(page, limit);

    const ws = workspaceId ? { workspaceId } : {};
    const where = { organizationId: user.organizationId, ...ws, isArchived: false };
    if (user.role === 'employee') {
      where.assignedTo = user.id;
      where[Op.or] = [{ scheduledFor: null }, { scheduledFor: { [Op.lte]: new Date() } }];
    }
    if (status) where.status = status;
    if (assignedTo && user.role !== 'employee') where.assignedTo = assignedTo;
    if (search) where.title = { [Op.like]: `%${search}%` };
    if (dateFrom || dateTo) {
      const from = dateFrom ? new Date(dateFrom) : null;
      const to = dateTo ? (() => { const d = new Date(dateTo); d.setDate(d.getDate() + 1); return d; })() : null;
      const scheduledCond = {};
      const createdCond = {};
      if (from) { scheduledCond[Op.gte] = from; createdCond[Op.gte] = from; }
      if (to) { scheduledCond[Op.lt] = to; createdCond[Op.lt] = to; }
      const dateCond = { [Op.or]: [{ scheduledFor: scheduledCond }, { createdAt: createdCond }] };
      if (where[Op.or]) {
        where[Op.and] = [{ [Op.or]: where[Op.or] }, dateCond];
        delete where[Op.or];
      } else {
        Object.assign(where, dateCond);
      }
    }

    const { count, rows } = await ContentTask.findAndCountAll({
      where,
      include: [
        { model: User, as: 'assignee', attributes: ['id', 'name', 'avatar'], required: false },
        { model: Lead, as: 'lead', attributes: ['id', 'name'], required: false },
        { model: User, as: 'creator', attributes: ['id', 'name'], required: false },
      ],
      order: [['dueDate', dueDateSort === 'desc' ? 'DESC' : 'ASC'], ['createdAt', 'DESC']],
      limit: lim, offset,
    });
    res.json({ success: true, ...paginateResponse(rows, count, page, lim) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch content tasks' });
  }
};

const getCalendarTasks = async (req, res) => {
  try {
    const { user, workspaceId } = req;
    const { month, year } = req.query;
    const m = parseInt(month) || new Date().getMonth() + 1;
    const y = parseInt(year) || new Date().getFullYear();

    const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
    const endDate = `${y}-${String(m).padStart(2, '0')}-${new Date(y, m, 0).getDate()}`;

    const ws = workspaceId ? { workspaceId } : {};
    const where = {
      organizationId: user.organizationId, ...ws,
      dueDate: { [Op.between]: [startDate, endDate] },
      isArchived: false,
    };
    if (user.role === 'employee') {
      where.assignedTo = user.id;
      where[Op.or] = [{ scheduledFor: null }, { scheduledFor: { [Op.lte]: new Date() } }];
    }

    const tasks = await ContentTask.findAll({
      where,
      include: [
        { model: User, as: 'assignee', attributes: ['id', 'name'], required: false },
        { model: Lead, as: 'lead', attributes: ['id', 'name'], required: false },
      ],
      order: [['dueDate', 'ASC']],
    });
    res.json({ success: true, tasks, month: m, year: y });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch calendar tasks' });
  }
};

const getTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { user, workspaceId } = req;
    const ws = workspaceId ? { workspaceId } : {};
    const where = { id, organizationId: user.organizationId, ...ws };
    if (user.role === 'employee') where.assignedTo = user.id;
    const task = await ContentTask.findOne({
      where,
      include: [
        { model: User, as: 'assignee', attributes: ['id', 'name'], required: false },
        { model: Lead, as: 'lead', attributes: ['id', 'name'], required: false },
        { model: User, as: 'creator', attributes: ['id', 'name'], required: false },
      ],
    });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
    res.json({ success: true, task });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch task' });
  }
};

const createTask = async (req, res) => {
  try {
    const { user, workspaceId } = req;
    if (!workspaceId) return res.status(400).json({ success: false, message: 'Workspace context required for this action' });
    const { leadId, title, description, assignedTo, dueDate, dueTime, priority, notes, requiresApproval, scheduledFor } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'Title is required' });

    const task = await ContentTask.create({
      organizationId: user.organizationId, workspaceId,
      leadId: leadId || null, assignedTo: assignedTo || null, createdBy: user.id,
      title, description: description || '',
      priority: priority || 'Medium', status: 'To Do Today',
      dueDate: dueDate || null, dueTime: dueTime || null, notes: notes || '',
      requiresApproval: requiresApproval !== false,
      scheduledFor: scheduledFor || null,
      isArchived: false,
    });
    res.status(201).json({ success: true, message: 'Content task created', task });
  } catch (err) {
    console.error('createTask error:', err);
    res.status(500).json({ success: false, message: 'Failed to create task' });
  }
};

const updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { user, workspaceId } = req;
    const ws = workspaceId ? { workspaceId } : {};

    const CONTENT_FIELDS = ['title', 'description', 'priority', 'dueDate', 'dueTime', 'notes', 'requiresApproval', 'assignedTo'];
    const isContentEdit = Object.keys(req.body).some(k => CONTENT_FIELDS.includes(k));

    let task;
    if (isContentEdit) {
      // Only the creator may edit task content
      task = await ContentTask.findOne({ where: { id, organizationId: user.organizationId, ...ws, createdBy: user.id } });
      if (!task) return res.status(403).json({ success: false, message: 'Only the creator can edit this task' });
    } else {
      // Status-only update (drag-and-drop): assignee restriction for employees
      const where = { id, organizationId: user.organizationId, ...ws };
      if (user.role === 'employee') where.assignedTo = user.id;
      task = await ContentTask.findOne({ where });
      if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const newStatus = req.body.status;
    if (newStatus) {
      const APPROVAL_ONLY = ['Approved', 'Not Approved'];
      if (APPROVAL_ONLY.includes(newStatus) && user.role === 'employee') {
        return res.status(403).json({ success: false, message: 'Only admins and owners can approve or reject tasks' });
      }
      if (newStatus === 'Done' && task.requiresApproval !== false) {
        return res.status(400).json({ success: false, message: 'This task requires approval — move it to Review first' });
      }
      if (['Review', 'Approved', 'Not Approved'].includes(newStatus) && task.requiresApproval === false) {
        return res.status(400).json({ success: false, message: 'This task has no approval flow — mark it as Done instead' });
      }
    }

    const allowed = user.role === 'employee'
      ? ['title', 'description', 'priority', 'status', 'dueDate', 'dueTime', 'notes', 'assigneeNotes']
      : ['title', 'description', 'priority', 'status', 'assignedTo', 'dueDate', 'dueTime', 'notes', 'requiresApproval', 'assigneeNotes', 'scheduledFor'];
    const updates = {};
    for (const k of allowed) { if (req.body[k] !== undefined) updates[k] = req.body[k]; }
    if (updates.dueDate === '') updates.dueDate = null;
    if (updates.dueTime === '') updates.dueTime = null;
    if (updates.scheduledFor === '') updates.scheduledFor = null;
    await task.update(updates);
    res.json({ success: true, message: 'Task updated', task });
  } catch (err) {
    console.error('updateTask error:', err);
    res.status(500).json({ success: false, message: 'Failed to update task' });
  }
};

const deleteTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { user, workspaceId } = req;
    const ws = workspaceId ? { workspaceId } : {};
    const where = { id, organizationId: user.organizationId, ...ws };
    const task = await ContentTask.findOne({ where });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
    await task.destroy();
    res.json({ success: true, message: 'Task deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete task' });
  }
};

const getTaskPipeline = async (req, res) => {
  try {
    const { user, workspaceId } = req;
    const { assignedTo } = req.query;
    const ws = workspaceId ? { workspaceId } : {};
    const where = { organizationId: user.organizationId, ...ws, isArchived: false };
    if (user.role === 'employee') {
      where.assignedTo = user.id;
      where[Op.or] = [{ scheduledFor: null }, { scheduledFor: { [Op.lte]: new Date() } }];
    } else if (assignedTo) where.assignedTo = assignedTo;

    const tasks = await ContentTask.findAll({
      where,
      include: [
        { model: User, as: 'assignee', attributes: ['id', 'name', 'avatar'], required: false },
        { model: User, as: 'creator', attributes: ['id', 'name'], required: false },
        { model: Lead, as: 'lead', attributes: ['id', 'name'], required: false },
      ],
      order: [['dueDate', 'ASC'], ['createdAt', 'ASC']],
    });

    const pipeline = {};
    PIPELINE_COLUMNS.forEach((col) => { pipeline[col] = []; });
    tasks.forEach((task) => { if (pipeline[task.status] !== undefined) pipeline[task.status].push(task); });

    res.json({ success: true, pipeline, columns: PIPELINE_COLUMNS });
  } catch (err) {
    console.error('getTaskPipeline error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch task pipeline' });
  }
};

const archiveTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { user, workspaceId } = req;
    const ws = workspaceId ? { workspaceId } : {};
    const where = { id, organizationId: user.organizationId, ...ws };
    if (user.role === 'employee') where.assignedTo = user.id;
    const task = await ContentTask.findOne({ where });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
    await task.update({ isArchived: true });
    res.json({ success: true, message: 'Task archived' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to archive task' });
  }
};

const unarchiveTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { user, workspaceId } = req;
    const ws = workspaceId ? { workspaceId } : {};
    const task = await ContentTask.findOne({ where: { id, organizationId: user.organizationId, ...ws } });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
    await task.update({ isArchived: false });
    res.json({ success: true, message: 'Task restored' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to restore task' });
  }
};

const archiveBulk = async (req, res) => {
  try {
    const { user, workspaceId } = req;
    const ws = workspaceId ? { workspaceId } : {};
    const where = { organizationId: user.organizationId, ...ws, status: { [Op.in]: COMPLETED_STATUSES }, isArchived: false };
    if (user.role === 'employee') where.assignedTo = user.id;
    const [count] = await ContentTask.update(
      { isArchived: true },
      { where }
    );
    res.json({ success: true, message: `Archived ${count} completed tasks`, count });
  } catch (err) {
    console.error('[archiveBulk] error:', err);
    res.status(500).json({ success: false, message: 'Failed to archive tasks' });
  }
};

const getArchivedTasks = async (req, res) => {
  try {
    const { user, workspaceId } = req;
    const { page = 1, limit = 20 } = req.query;
    const { limit: lim, offset } = paginate(page, limit);
    const ws = workspaceId ? { workspaceId } : {};
    const where = { organizationId: user.organizationId, ...ws, isArchived: true };
    if (user.role === 'employee') where.assignedTo = user.id;

    const { count, rows } = await ContentTask.findAndCountAll({
      where,
      include: [
        { model: User, as: 'assignee', attributes: ['id', 'name'], required: false },
        { model: Lead, as: 'lead', attributes: ['id', 'name'], required: false },
      ],
      order: [['updatedAt', 'DESC']],
      limit: lim, offset,
    });
    res.json({ success: true, ...paginateResponse(rows, count, page, lim) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch archived tasks' });
  }
};

module.exports = {
  getTasks, getCalendarTasks, getTask, createTask, updateTask, deleteTask,
  getTaskPipeline, archiveTask, unarchiveTask, archiveBulk, getArchivedTasks,
};
