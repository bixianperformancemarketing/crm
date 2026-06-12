const { Op } = require('sequelize');
const { ContentTask, User, Lead } = require('../../config/models');
const { paginate, paginateResponse } = require('../../utils/helpers');

const PIPELINE_COLUMNS = ['Overdue', 'To Do Today', 'In Progress', 'Done', 'Review', 'Approved', 'Not Approved'];
const COMPLETED_STATUSES = ['Done', 'Approved', 'Cancelled'];

const getTasks = async (req, res) => {
  try {
    const { user, workspaceId } = req;
    const { page = 1, limit = 20, status, assignedTo, dateFrom, dateTo } = req.query;
    const { limit: lim, offset } = paginate(page, limit);

    const ws = workspaceId ? { workspaceId } : {};
    const where = { organizationId: user.organizationId, ...ws, isArchived: false };
    if (user.role === 'employee') where.assignedTo = user.id;
    if (status) where.status = status;
    if (assignedTo && user.role !== 'employee') where.assignedTo = assignedTo;
    if (dateFrom || dateTo) {
      where.dueDate = {};
      if (dateFrom) where.dueDate[Op.gte] = dateFrom;
      if (dateTo) where.dueDate[Op.lte] = dateTo;
    }

    const { count, rows } = await ContentTask.findAndCountAll({
      where,
      include: [
        { model: User, as: 'assignee', attributes: ['id', 'name', 'avatar'], required: false },
        { model: Lead, as: 'lead', attributes: ['id', 'name'], required: false },
        { model: User, as: 'creator', attributes: ['id', 'name'], required: false },
      ],
      order: [['dueDate', 'ASC'], ['createdAt', 'DESC']],
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
    if (user.role === 'employee') where.assignedTo = user.id;

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
    const { leadId, title, description, assignedTo, dueDate, dueTime, priority, notes, requiresApproval } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'Title is required' });

    const task = await ContentTask.create({
      organizationId: user.organizationId, workspaceId,
      leadId: leadId || null, assignedTo: assignedTo || null, createdBy: user.id,
      title, description: description || '',
      priority: priority || 'Medium', status: 'To Do Today',
      dueDate: dueDate || null, dueTime: dueTime || null, notes: notes || '',
      requiresApproval: requiresApproval !== false,
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
    const where = { id, organizationId: user.organizationId, ...ws };
    if (user.role === 'employee') where.assignedTo = user.id;
    const task = await ContentTask.findOne({ where });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

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

    const allowed = ['title', 'description', 'priority', 'status', 'assignedTo', 'dueDate', 'dueTime', 'notes', 'requiresApproval'];
    const updates = {};
    for (const k of allowed) { if (req.body[k] !== undefined) updates[k] = req.body[k]; }
    await task.update(updates);
    res.json({ success: true, message: 'Task updated', task });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update task' });
  }
};

const deleteTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { user, workspaceId } = req;
    const ws = workspaceId ? { workspaceId } : {};
    const task = await ContentTask.findOne({ where: { id, organizationId: user.organizationId, ...ws } });
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
    const ws = workspaceId ? { workspaceId } : {};
    const where = { organizationId: user.organizationId, ...ws, isArchived: false };
    if (user.role === 'employee') where.assignedTo = user.id;

    const tasks = await ContentTask.findAll({
      where,
      include: [
        { model: User, as: 'assignee', attributes: ['id', 'name', 'avatar'], required: false },
        { model: Lead, as: 'lead', attributes: ['id', 'name'], required: false },
      ],
      order: [['dueDate', 'ASC'], ['createdAt', 'DESC']],
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
    const task = await ContentTask.findOne({ where: { id, organizationId: user.organizationId, ...ws } });
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
    const [count] = await ContentTask.update(
      { isArchived: true },
      {
        where: {
          organizationId: user.organizationId, ...ws,
          status: { [Op.in]: COMPLETED_STATUSES },
          isArchived: false,
        },
      }
    );
    res.json({ success: true, message: `Archived ${count} completed tasks`, count });
  } catch (err) {
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
