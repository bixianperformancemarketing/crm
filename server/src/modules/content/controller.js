const { Op } = require('sequelize');
const { ContentTask, User, Lead } = require('../../config/models');
const { paginate, paginateResponse } = require('../../utils/helpers');

const getTasks = async (req, res) => {
  try {
    const { user, workspaceId } = req;
    const { page = 1, limit = 20, status, assignedTo, dateFrom, dateTo } = req.query;
    const { limit: lim, offset } = paginate(page, limit);

    const ws = workspaceId ? { workspaceId } : {};
    const where = { organizationId: user.organizationId, ...ws };
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
    const { leadId, title, description, assignedTo, dueDate, dueTime, priority, notes } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'Title is required' });

    const task = await ContentTask.create({
      organizationId: user.organizationId, workspaceId,
      leadId: leadId || null, assignedTo: assignedTo || null, createdBy: user.id,
      title, description: description || '',
      priority: priority || 'Medium', status: 'Overview',
      dueDate: dueDate || null, dueTime: dueTime || null, notes: notes || '',
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

    const allowed = ['title', 'description', 'priority', 'status', 'assignedTo', 'dueDate', 'dueTime', 'notes'];
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
    const where = { organizationId: user.organizationId, ...ws };
    if (user.role === 'employee') where.assignedTo = user.id;

    const tasks = await ContentTask.findAll({
      where,
      include: [
        { model: User, as: 'assignee', attributes: ['id', 'name', 'avatar'], required: false },
        { model: Lead, as: 'lead', attributes: ['id', 'name'], required: false },
      ],
      order: [['dueDate', 'ASC'], ['createdAt', 'DESC']],
    });

    const columns = ['Overview', 'To Do Today', 'In Progress', 'Review', 'Approved', 'Not Approved'];
    const pipeline = {};
    columns.forEach((col) => { pipeline[col] = []; });
    tasks.forEach((task) => { if (pipeline[task.status]) pipeline[task.status].push(task); });

    res.json({ success: true, pipeline, columns });
  } catch (err) {
    console.error('getTaskPipeline error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch task pipeline' });
  }
};

module.exports = { getTasks, getCalendarTasks, getTask, createTask, updateTask, deleteTask, getTaskPipeline };
