const { Op, fn, col } = require('sequelize');
const { Appointment, User, Lead, LeadActivity } = require('../../config/models');
const { paginate, paginateResponse, startOfTodayIST, endOfTodayIST } = require('../../utils/helpers');
const notificationService = require('../../services/notificationService');

const getAppointments = async (req, res) => {
  try {
    const { user, workspaceId } = req;
    const { page = 1, limit = 20, status, type, assignedTo, dateFrom, dateTo } = req.query;
    const { limit: lim, offset } = paginate(page, limit);

    const where = { organizationId: user.organizationId, workspaceId };
    if (user.role === 'employee') where.assignedTo = user.id;
    if (status) where.status = status;
    if (type) where.type = type;
    if (assignedTo && user.role === 'admin') where.assignedTo = assignedTo;
    if (dateFrom || dateTo) {
      where.startTime = {};
      if (dateFrom) where.startTime[Op.gte] = new Date(dateFrom);
      if (dateTo) where.startTime[Op.lte] = new Date(dateTo);
    }

    const { count, rows } = await Appointment.findAndCountAll({
      where,
      include: [
        { model: Lead, as: 'lead', attributes: ['id', 'name', 'phone'], required: false },
        { model: User, as: 'assignee', attributes: ['id', 'name', 'avatar'], required: false },
        { model: User, as: 'creator', attributes: ['id', 'name'], required: false },
      ],
      order: [['startTime', 'ASC']],
      limit: lim,
      offset,
    });

    res.json({ success: true, ...paginateResponse(rows, count, page, lim) });
  } catch (err) {
    console.error('getAppointments error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch appointments' });
  }
};

const getCalendar = async (req, res) => {
  try {
    const { user, workspaceId } = req;
    const { month, year } = req.query;
    const m = parseInt(month) || new Date().getMonth() + 1;
    const y = parseInt(year) || new Date().getFullYear();

    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0, 23, 59, 59);

    const where = {
      organizationId: user.organizationId,
      workspaceId,
      startTime: { [Op.between]: [start, end] },
    };
    if (user.role === 'employee') where.assignedTo = user.id;

    const appointments = await Appointment.findAll({
      where,
      include: [
        { model: Lead, as: 'lead', attributes: ['id', 'name'], required: false },
        { model: User, as: 'assignee', attributes: ['id', 'name'], required: false },
      ],
      order: [['startTime', 'ASC']],
    });

    res.json({ success: true, appointments, month: m, year: y });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch calendar' });
  }
};

const getTodayAppointments = async (req, res) => {
  try {
    const { user, workspaceId } = req;
    const where = {
      organizationId: user.organizationId,
      workspaceId,
      startTime: { [Op.between]: [startOfTodayIST(), endOfTodayIST()] },
    };
    if (user.role === 'employee') where.assignedTo = user.id;

    const appointments = await Appointment.findAll({
      where,
      include: [
        { model: Lead, as: 'lead', attributes: ['id', 'name', 'phone'], required: false },
        { model: User, as: 'assignee', attributes: ['id', 'name', 'avatar'], required: false },
      ],
      order: [['startTime', 'ASC']],
    });
    res.json({ success: true, appointments });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch today appointments' });
  }
};

const getUpcoming = async (req, res) => {
  try {
    const { user, workspaceId } = req;
    const where = {
      organizationId: user.organizationId, workspaceId,
      startTime: { [Op.gte]: new Date() },
      status: 'Scheduled',
    };
    if (user.role === 'employee') where.assignedTo = user.id;

    const appointments = await Appointment.findAll({
      where,
      include: [
        { model: Lead, as: 'lead', attributes: ['id', 'name'], required: false },
        { model: User, as: 'assignee', attributes: ['id', 'name'], required: false },
      ],
      order: [['startTime', 'ASC']],
      limit: 10,
    });
    res.json({ success: true, appointments });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch upcoming appointments' });
  }
};

const createAppointment = async (req, res) => {
  try {
    const { user, workspaceId } = req;
    const { leadId, title, description, startTime, endTime, type, assignedTo, location, meetingLink, notes } = req.body;
    if (!title || !startTime || !endTime) {
      return res.status(400).json({ success: false, message: 'Title, start time, and end time are required' });
    }

    const appointment = await Appointment.create({
      organizationId: user.organizationId, workspaceId,
      leadId: leadId || null, createdBy: user.id,
      assignedTo: assignedTo || user.id,
      title, description, startTime, endTime,
      type: type || 'Meeting', status: 'Scheduled',
      location, meetingLink, notes,
    });

    if (leadId) {
      await LeadActivity.create({
        leadId, organizationId: user.organizationId, workspaceId,
        userId: user.id, type: 'note_added',
        description: `Appointment scheduled: ${title}`,
        metadata: { appointmentId: appointment.id },
      });
    }

    res.status(201).json({ success: true, message: 'Appointment created', appointment });
  } catch (err) {
    console.error('createAppointment error:', err);
    res.status(500).json({ success: false, message: 'Failed to create appointment' });
  }
};

const updateAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const { user, workspaceId } = req;
    const appt = await Appointment.findOne({ where: { id, organizationId: user.organizationId, workspaceId } });
    if (!appt) return res.status(404).json({ success: false, message: 'Appointment not found' });
    const allowed = ['title', 'description', 'startTime', 'endTime', 'type', 'assignedTo', 'location', 'meetingLink', 'notes'];
    const updates = {};
    for (const k of allowed) { if (req.body[k] !== undefined) updates[k] = req.body[k]; }
    await appt.update(updates);
    res.json({ success: true, message: 'Appointment updated', appointment: appt });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update appointment' });
  }
};

const updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { user, workspaceId } = req;
    const { status, notes } = req.body;
    const appt = await Appointment.findOne({ where: { id, organizationId: user.organizationId, workspaceId } });
    if (!appt) return res.status(404).json({ success: false, message: 'Appointment not found' });
    await appt.update({ status, notes: notes || appt.notes });
    if (appt.leadId) {
      await LeadActivity.create({
        leadId: appt.leadId, organizationId: user.organizationId, workspaceId,
        userId: user.id, type: 'note_added',
        description: `Appointment ${status}: ${appt.title}. ${notes || ''}`,
        metadata: { appointmentId: appt.id },
      });
    }
    res.json({ success: true, message: 'Status updated', appointment: appt });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update status' });
  }
};

const deleteAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const { user, workspaceId } = req;
    const appt = await Appointment.findOne({ where: { id, organizationId: user.organizationId, workspaceId } });
    if (!appt) return res.status(404).json({ success: false, message: 'Appointment not found' });
    await appt.destroy();
    res.json({ success: true, message: 'Appointment deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete appointment' });
  }
};

module.exports = { getAppointments, getCalendar, getTodayAppointments, getUpcoming, createAppointment, updateAppointment, updateStatus, deleteAppointment };
