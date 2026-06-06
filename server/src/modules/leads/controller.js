const { Op, fn, col } = require('sequelize');
const {
  Lead, LeadActivity, User, Followup, Quotation, Invoice, Appointment, ContentTask, Workspace,
} = require('../../config/models');
const { paginate, paginateResponse, calculateLeadScore, isHotLead, parseCSV, mapCSVFieldToLead } = require('../../utils/helpers');
const notificationService = require('../../services/notificationService');
const emailService = require('../../services/emailService');
const { logUsage } = require('../../middleware/entitlement');

const findLeastLoadedAgent = async (workspaceId, organizationId) => {
  const agents = await User.findAll({
    where: { workspaceId, organizationId, role: { [Op.in]: ['employee', 'admin'] }, isActive: true },
    attributes: ['id'],
  });
  if (!agents.length) return null;
  const counts = await Promise.all(agents.map(async (a) => ({
    id: a.id,
    count: await Lead.count({ where: { assignedTo: a.id, status: { [Op.notIn]: ['Won', 'Lost'] } } }),
  })));
  counts.sort((a, b) => a.count - b.count);
  return counts[0]?.id || null;
};

const getLeads = async (req, res) => {
  try {
    const { workspaceId, user } = req;
    const { page = 1, limit = 50, search, status, source, priority, assignedTo, city, dateFrom, dateTo, sort = 'createdAt', order = 'DESC' } = req.query;
    const { limit: lim, offset } = paginate(page, limit);

    const ws = workspaceId ? { workspaceId } : {};
    const where = { organizationId: user.organizationId, ...ws };
    if (user.role === 'employee') where.assignedTo = user.id;
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
      ];
    }
    if (status) where.status = status;
    if (source) where.source = source;
    if (priority) where.priority = priority;
    if (assignedTo) where.assignedTo = assignedTo;
    if (city) where.city = { [Op.like]: `%${city}%` };
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt[Op.gte] = new Date(dateFrom);
      if (dateTo) where.createdAt[Op.lte] = new Date(dateTo);
    }

    const validSorts = ['createdAt', 'name', 'status', 'priority', 'score', 'nextFollowup'];
    const sortCol = validSorts.includes(sort) ? sort : 'createdAt';
    const sortOrder = order === 'ASC' ? 'ASC' : 'DESC';

    const { count, rows } = await Lead.findAndCountAll({
      where,
      include: [
        { model: User, as: 'assignedAgent', attributes: ['id', 'name', 'email', 'avatar'], required: false },
        { model: Workspace, as: 'workspace', attributes: ['id', 'name'], required: false },
      ],
      order: [[sortCol, sortOrder]],
      limit: lim,
      offset,
    });

    res.json({ success: true, ...paginateResponse(rows, count, page, lim) });
  } catch (err) {
    console.error('getLeads error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch leads' });
  }
};

const getLead = async (req, res) => {
  try {
    const { id } = req.params;
    const { user, workspaceId } = req;
    const ws = workspaceId ? { workspaceId } : {};
    const where = { id, organizationId: user.organizationId, ...ws };
    if (user.role === 'employee') where.assignedTo = user.id;

    const lead = await Lead.findOne({
      where,
      include: [
        { model: User, as: 'assignedAgent', attributes: ['id', 'name', 'email', 'avatar'] },
        { model: Workspace, as: 'workspace', attributes: ['id', 'name'], required: false },
        { model: LeadActivity, as: 'activities', include: [{ model: User, as: 'user', attributes: ['id', 'name'], required: false }], order: [['createdAt', 'DESC']], limit: 50 },
        { model: Followup, as: 'followups', where: { status: { [Op.ne]: 'cancelled' } }, required: false, order: [['scheduledAt', 'DESC']] },
        { model: Quotation, as: 'quotations', required: false, order: [['createdAt', 'DESC']] },
        { model: Invoice, as: 'invoices', required: false, order: [['createdAt', 'DESC']] },
        { model: Appointment, as: 'appointments', required: false, order: [['startTime', 'DESC']], limit: 5 },
      ],
    });

    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    const cooldown = new Date(Date.now() - 2 * 60 * 60 * 1000);
    LeadActivity.findOne({
      where: { leadId: lead.id, userId: user.id, type: 'viewed', createdAt: { [Op.gte]: cooldown } },
    }).then((recent) => {
      if (!recent) {
        LeadActivity.create({
          leadId: lead.id, organizationId: user.organizationId, workspaceId: lead.workspaceId,
          userId: user.id, type: 'viewed', description: `Lead viewed by ${user.name || user.role}`, metadata: {}
        }).catch(() => {});
      }
    }).catch(() => {});

    res.json({ success: true, lead });
  } catch (err) {
    console.error('getLead error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch lead' });
  }
};

const createLead = async (req, res) => {
  try {
    const { user, workspaceId, org } = req;
    if (!workspaceId) return res.status(400).json({ success: false, message: 'Workspace context required for this action' });
    const {
      name, phone, email, source, campaign, priority, status,
      assignedTo, city, clientAddress, clientGST, clientType, nextFollowup,
      metadata = {},
    } = req.body;

    if (!name) return res.status(400).json({ success: false, message: 'Lead name is required' });

    if (phone) {
      const dup = await Lead.findOne({ where: { phone, organizationId: user.organizationId } });
      if (dup) {
        await dup.increment('repeatCount');
        await dup.update({ isDuplicate: true });
        await LeadActivity.create({
          leadId: dup.id, organizationId: user.organizationId, workspaceId: dup.workspaceId,
          userId: user.id, type: 'duplicate_detected',
          description: `Duplicate submission detected. Phone: ${phone}`, metadata: {},
        });
        return res.status(200).json({ success: true, isDuplicate: true, lead: dup, message: 'Duplicate lead detected' });
      }
    }

    const leadData = { organizationId: user.organizationId, workspaceId, name, phone, email, source, campaign, priority: priority || 'Medium', status: status || 'New', assignedTo: assignedTo || null, city, clientAddress, clientGST, clientType: clientType || 'Other', nextFollowup, lastCallNote: '', metadata };
    leadData.score = calculateLeadScore(leadData);
    leadData.isHot = isHotLead(leadData);

    const lead = await Lead.create(leadData);
    await LeadActivity.create({ leadId: lead.id, organizationId: user.organizationId, workspaceId, userId: user.id, type: 'created', description: `Lead created via ${source || 'manual entry'}`, metadata: {} });

    if (assignedTo) {
      const assignedUser = await User.findByPk(assignedTo, { attributes: ['id', 'name', 'email'] });
      if (assignedUser) {
        await notificationService.notifyLeadAssigned({ lead, assignedUser, organizationId: user.organizationId, workspaceId });
      }
    }

    const admins = await User.findAll({ where: { workspaceId, organizationId: user.organizationId, role: 'admin', isActive: true }, attributes: ['id'] });
    await notificationService.notifyNewLead({ lead, adminIds: admins.map((a) => a.id), organizationId: user.organizationId, workspaceId });

    if (email && org?.settings) {
      emailService.sendLeadAcknowledgement(lead, org.settings, org.settings?.smtpConfig).catch(console.error);
    }

    await logUsage(user.organizationId, workspaceId, 'lead_created');
    res.status(201).json({ success: true, message: 'Lead created', lead });
  } catch (err) {
    console.error('createLead error:', err);
    res.status(500).json({ success: false, message: 'Failed to create lead' });
  }
};

const updateLead = async (req, res) => {
  try {
    const { id } = req.params;
    const { user, workspaceId } = req;
    const ws = workspaceId ? { workspaceId } : {};
    const where = { id, organizationId: user.organizationId, ...ws };
    if (user.role === 'employee') where.assignedTo = user.id;

    const lead = await Lead.findOne({ where });
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    const prevStatus = lead.status;
    const allowed = ['name', 'phone', 'email', 'source', 'campaign', 'priority', 'status', 'assignedTo', 'city', 'clientAddress', 'clientGST', 'clientType', 'nextFollowup', 'lastCallNote', 'metadata'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (updates.assignedTo === '' || updates.assignedTo === 0) updates.assignedTo = null;

    if (Object.keys(updates).length) {
      const merged = { ...lead.toJSON(), ...updates };
      updates.score = calculateLeadScore(merged);
      updates.isHot = isHotLead(merged);
      await lead.update(updates);
    }

    if (updates.status && updates.status !== prevStatus) {
      await LeadActivity.create({
        leadId: lead.id, organizationId: user.organizationId, workspaceId: lead.workspaceId,
        userId: user.id, type: 'status_changed',
        description: `Status changed from ${prevStatus} to ${updates.status}`, metadata: {},
      });
    }

    if (updates.assignedTo && updates.assignedTo !== lead.assignedTo) {
      const assignedUser = await User.findByPk(updates.assignedTo, { attributes: ['id', 'name'] });
      if (assignedUser) {
        await notificationService.notifyLeadAssigned({ lead: { ...lead.toJSON(), name: lead.name }, assignedUser, organizationId: user.organizationId, workspaceId: lead.workspaceId });
      }
      await LeadActivity.create({
        leadId: lead.id, organizationId: user.organizationId, workspaceId: lead.workspaceId,
        userId: user.id, type: 'assigned',
        description: `Lead assigned to ${assignedUser?.name || 'agent'}`, metadata: {},
      });
    }

    res.json({ success: true, message: 'Lead updated', lead });
  } catch (err) {
    console.error('updateLead error:', err);
    res.status(500).json({ success: false, message: 'Failed to update lead' });
  }
};

const deleteLead = async (req, res) => {
  try {
    const { id } = req.params;
    const { user, workspaceId } = req;
    const ws = workspaceId ? { workspaceId } : {};
    const lead = await Lead.findOne({ where: { id, organizationId: user.organizationId, ...ws } });
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
    await lead.destroy();
    res.json({ success: true, message: 'Lead deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete lead' });
  }
};

const getPipeline = async (req, res) => {
  try {
    const { user, workspaceId } = req;
    const ws = workspaceId ? { workspaceId } : {};
    const where = { organizationId: user.organizationId, ...ws };
    if (user.role === 'employee') where.assignedTo = user.id;

    const leads = await Lead.findAll({
      where,
      include: [{ model: User, as: 'assignedAgent', attributes: ['id', 'name', 'avatar'], required: false }],
      order: [['createdAt', 'DESC']],
    });

    const columns = ['New', 'Discussion', 'Meeting', 'Quotation', 'Won', 'Lost'];
    const pipeline = {};
    columns.forEach((col) => { pipeline[col] = []; });
    leads.forEach((lead) => { if (pipeline[lead.status]) pipeline[lead.status].push(lead); });

    res.json({ success: true, pipeline, columns });
  } catch (err) {
    console.error('getPipeline error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch pipeline' });
  }
};

const addNote = async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;
    const { user, workspaceId } = req;
    if (!note) return res.status(400).json({ success: false, message: 'Note is required' });

    const ws = workspaceId ? { workspaceId } : {};
    const lead = await Lead.findOne({ where: { id, organizationId: user.organizationId, ...ws } });
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    const activity = await LeadActivity.create({
      leadId: lead.id, organizationId: user.organizationId, workspaceId: lead.workspaceId,
      userId: user.id, type: 'note_added',
      description: note, metadata: {},
    });
    await lead.update({ lastCallNote: note });
    res.json({ success: true, message: 'Note added', activity });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to add note' });
  }
};

const importCSV = async (req, res) => {
  try {
    const { user, workspaceId, org } = req;
    if (!workspaceId) return res.status(400).json({ success: false, message: 'Workspace context required for this action' });
    if (!req.file) return res.status(400).json({ success: false, message: 'CSV file required' });

    // Detect UTF-16 LE BOM (Meta Ads exports) and decode accordingly
    const buf = req.file.buffer;
    const text = (buf[0] === 0xFF && buf[1] === 0xFE) ? buf.toString('utf16le') : buf.toString('utf8');
    const { rows } = parseCSV(text);

    if (!rows.length) return res.status(400).json({ success: false, message: 'No data rows found in CSV' });

    const { Lead: LeadModel } = require('../../config/models');
    const currentCount = await LeadModel.count({ where: { organizationId: user.organizationId } });
    const available = org.maxLeadsTotal - currentCount;

    const results = { created: 0, duplicates: 0, skipped: 0, errors: [] };
    const toCreate = [];
    const seen = new Set();

    for (const row of rows) {
      const mapped = mapCSVFieldToLead(Object.keys(row), row);
      if (!mapped.name && !mapped.phone) { results.skipped++; continue; }

      if (mapped.phone) {
        if (seen.has(mapped.phone)) { results.duplicates++; continue; }
        const existing = await LeadModel.findOne({ where: { phone: mapped.phone, organizationId: user.organizationId } });
        if (existing) {
          await existing.increment('repeatCount');
          await existing.update({ isDuplicate: true });
          await LeadActivity.create({ leadId: existing.id, organizationId: user.organizationId, workspaceId: existing.workspaceId, userId: user.id, type: 'csv_imported', description: 'Duplicate detected during CSV import', metadata: mapped.metadata || {} });
          results.duplicates++;
          seen.add(mapped.phone);
          continue;
        }
        seen.add(mapped.phone);
      }

      if (toCreate.length >= available) { results.skipped++; continue; }
      toCreate.push(mapped);
    }

    const autoAgentId = await findLeastLoadedAgent(workspaceId, user.organizationId);

    for (const data of toCreate) {
      try {
        const leadData = {
          organizationId: user.organizationId, workspaceId,
          name: data.name || 'Unknown', phone: data.phone, email: data.email,
          source: 'CSV Import', campaign: data.campaign, city: data.city, clientAddress: data.clientAddress,
          priority: 'Medium', status: 'New', assignedTo: autoAgentId, metadata: data.metadata || {},
        };
        leadData.score = calculateLeadScore(leadData);
        leadData.isHot = isHotLead(leadData);
        const lead = await Lead.create(leadData);
        await LeadActivity.create({ leadId: lead.id, organizationId: user.organizationId, workspaceId, userId: user.id, type: 'csv_imported', description: 'Lead imported via CSV', metadata: {} });
        results.created++;
      } catch (e) {
        results.errors.push(e.message);
      }
    }

    await logUsage(user.organizationId, workspaceId, 'csv_imported');
    res.json({ success: true, message: `CSV import complete`, ...results });
  } catch (err) {
    console.error('importCSV error:', err);
    res.status(500).json({ success: false, message: 'CSV import failed' });
  }
};

const bulkAssign = async (req, res) => {
  try {
    const { user, workspaceId } = req;
    const { leadIds, assignedTo } = req.body;

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({ success: false, message: 'leadIds must be a non-empty array' });
    }
    if (!assignedTo) {
      return res.status(400).json({ success: false, message: 'assignedTo is required' });
    }

    const ws = workspaceId ? { workspaceId } : {};
    const assignedUser = await User.findOne({
      where: { id: assignedTo, organizationId: user.organizationId, ...ws, isActive: true },
      attributes: ['id', 'name'],
    });
    if (!assignedUser) {
      return res.status(404).json({ success: false, message: 'Target user not found in this workspace' });
    }

    const [count] = await Lead.update(
      { assignedTo },
      { where: { id: { [Op.in]: leadIds }, organizationId: user.organizationId, ...ws } }
    );

    await LeadActivity.bulkCreate(
      leadIds.map((leadId) => ({
        leadId,
        organizationId: user.organizationId,
        workspaceId: workspaceId || null,
        userId: user.id,
        type: 'assigned',
        description: `Lead bulk-assigned to ${assignedUser.name}`,
        metadata: {},
      }))
    );

    await notificationService.notifyLeadAssigned({
      lead: { name: `${count} leads` },
      assignedUser,
      organizationId: user.organizationId,
      workspaceId: workspaceId || null,
    });

    res.json({ success: true, message: `${count} lead(s) assigned to ${assignedUser.name}`, count });
  } catch (err) {
    console.error('bulkAssign error:', err);
    res.status(500).json({ success: false, message: 'Bulk assign failed' });
  }
};

const bulkDelete = async (req, res) => {
  try {
    const { user, workspaceId } = req;
    const { leadIds } = req.body;

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({ success: false, message: 'leadIds must be a non-empty array' });
    }

    const ws = workspaceId ? { workspaceId } : {};
    const count = await Lead.destroy({
      where: { id: { [Op.in]: leadIds }, organizationId: user.organizationId, ...ws },
    });

    res.json({ success: true, message: `${count} lead(s) deleted`, count });
  } catch (err) {
    console.error('bulkDelete error:', err);
    res.status(500).json({ success: false, message: 'Bulk delete failed' });
  }
};

module.exports = { getLeads, getLead, createLead, updateLead, deleteLead, getPipeline, addNote, importCSV, bulkAssign, bulkDelete };
