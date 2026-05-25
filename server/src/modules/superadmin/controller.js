const bcrypt = require('bcryptjs');
const { Op, fn, col, literal } = require('sequelize');
const {
  Organization, User, Workspace, Lead, Plan, Invoice, Payment,
} = require('../../config/models');
const { generateSlug, generateWebhookToken } = require('../../utils/helpers');
const emailService = require('../../services/emailService');

const getDashboard = async (req, res) => {
  try {
    const [totalOrgs, activeOrgs, suspendedOrgs, totalUsers, totalLeads] = await Promise.all([
      Organization.count({ where: { isActive: true } }),
      Organization.count({ where: { isActive: true, isSuspended: false } }),
      Organization.count({ where: { isActive: true, isSuspended: true } }),
      User.count({ where: { role: { [Op.ne]: 'superadmin' }, isActive: true } }),
      Lead.count(),
    ]);

    const recentOrgs = await Organization.findAll({
      where: { isActive: true },
      order: [['createdAt', 'DESC']],
      limit: 10,
      attributes: ['id', 'name', 'slug', 'plan', 'ownerEmail', 'isActive', 'isSuspended', 'planExpiresAt', 'createdAt'],
    });

    const expiringIn30 = await Organization.findAll({
      where: {
        isActive: true,
        planExpiresAt: {
          [Op.between]: [new Date(), new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)],
        },
      },
      attributes: ['id', 'name', 'plan', 'ownerEmail', 'planExpiresAt'],
      order: [['planExpiresAt', 'ASC']],
    });

    const planCounts = await Organization.findAll({
      where: { isActive: true },
      attributes: ['plan', [fn('COUNT', col('id')), 'count']],
      group: ['plan'],
      raw: true,
    });

    res.json({
      success: true,
      stats: { totalOrgs, activeOrgs, suspendedOrgs, totalUsers, totalLeads },
      recentOrgs,
      expiringIn30,
      planCounts,
    });
  } catch (err) {
    console.error('SA dashboard error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard' });
  }
};

const getOrganizations = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, plan, status } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const where = { isActive: true };
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { ownerEmail: { [Op.like]: `%${search}%` } },
        { slug: { [Op.like]: `%${search}%` } },
      ];
    }
    if (plan) where.plan = plan;
    if (status === 'active') { where.isActive = true; where.isSuspended = false; }
    if (status === 'suspended') where.isSuspended = true;
    if (status === 'inactive') where.isActive = false;
    if (status === 'inactive') where.isActive = false;

    const { count, rows } = await Organization.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset,
      attributes: ['id', 'name', 'slug', 'plan', 'ownerName', 'ownerEmail', 'ownerPhone', 'isActive', 'isSuspended', 'planExpiresAt', 'maxWorkspaces', 'maxLeadsTotal', 'createdAt'],
    });

    const orgsWithStats = await Promise.all(rows.map(async (org) => {
      const [leadCount, userCount, workspaceCount] = await Promise.all([
        Lead.count({ where: { organizationId: org.id } }),
        User.count({ where: { organizationId: org.id } }),
        Workspace.count({ where: { organizationId: org.id } }),
      ]);
      return { ...org.toJSON(), leadCount, userCount, workspaceCount };
    }));

    res.json({
      success: true,
      data: orgsWithStats,
      pagination: { total: count, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(count / parseInt(limit)) },
    });
  } catch (err) {
    console.error('getOrganizations error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch organizations' });
  }
};

const getOrganization = async (req, res) => {
  try {
    const { id } = req.params;
    const org = await Organization.findByPk(id);
    if (!org) return res.status(404).json({ success: false, message: 'Organization not found' });

    const [workspaces, users, leadCount] = await Promise.all([
      Workspace.findAll({ where: { organizationId: id }, attributes: ['id', 'name', 'slug', 'isActive', 'createdAt'] }),
      User.count({ where: { organizationId: id } }),
      Lead.count({ where: { organizationId: id } }),
    ]);

    res.json({ success: true, organization: org, workspaces, userCount: users, leadCount });
  } catch (err) {
    console.error('getOrganization error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch organization' });
  }
};

const createOrganization = async (req, res) => {
  try {
    const {
      name, ownerName, ownerEmail, ownerPhone, plan = 'trial',
      maxWorkspaces, maxUsersPerWorkspace, maxLeadsTotal, planDays = 14,
    } = req.body;

    if (!name || !ownerName || !ownerEmail) {
      return res.status(400).json({ success: false, message: 'Name, owner name and email are required' });
    }

    const existing = await User.findOne({ where: { email: ownerEmail.toLowerCase(), isActive: true } });
    if (existing) return res.status(400).json({ success: false, message: 'Email already registered' });

    const planConfig = await Plan.findOne({ where: { name: plan } });
    const planExpiry = new Date(Date.now() + (planDays || planConfig?.durationDays || 14) * 24 * 60 * 60 * 1000);
    const slug = generateSlug(name);
    const webhookToken = generateWebhookToken();

    let uniqueSlug = slug;
    let slugCounter = 1;
    while (await Organization.findOne({ where: { slug: uniqueSlug } })) {
      uniqueSlug = `${slug}-${slugCounter++}`;
    }

    const org = await Organization.create({
      name,
      slug: uniqueSlug,
      ownerEmail: ownerEmail.toLowerCase(),
      ownerName,
      ownerPhone,
      plan,
      planExpiresAt: planExpiry,
      isActive: true,
      isSuspended: false,
      maxWorkspaces: maxWorkspaces || planConfig?.maxWorkspaces || 1,
      maxUsersPerWorkspace: maxUsersPerWorkspace || planConfig?.maxUsersPerWorkspace || 3,
      maxLeadsPerWorkspace: planConfig?.maxLeadsTotal || 100,
      maxLeadsTotal: maxLeadsTotal || planConfig?.maxLeadsTotal || 100,
      canUseWebhooks: planConfig?.canUseWebhooks || false,
      canUsePDF: planConfig?.canUsePDF || false,
      canUseCSVImport: planConfig?.canUseCSVImport || false,
      canUseContentCalendar: planConfig?.canUseContentCalendar || false,
      canUseAdvancedReports: planConfig?.canUseAdvancedReports || false,
      webhookToken,
      settings: {
        branding: { companyName: name, logo: null, address: '', gst: '', phone: ownerPhone || '', email: ownerEmail, website: '' },
        smtpConfig: null,
      },
    });

    const tempPassword = `Owner@${Math.random().toString(36).slice(-6).toUpperCase()}`;
    const hashedPw = await bcrypt.hash(tempPassword, 12);
    await User.create({
      organizationId: org.id,
      workspaceId: null,
      name: ownerName,
      email: ownerEmail.toLowerCase(),
      password: hashedPw,
      role: 'owner',
      phone: ownerPhone,
      isActive: true,
    });

    // Email credentials to the owner
    emailService.sendWelcomeEmail(ownerEmail.toLowerCase(), ownerName, name, tempPassword).catch((e) => {
      console.error('Failed to send welcome email:', e.message);
    });

    res.status(201).json({
      success: true,
      message: 'Organization created successfully. Welcome email sent to the owner.',
      organization: org,
      tempPassword,
    });
  } catch (err) {
    console.error('createOrganization error:', err);
    res.status(500).json({ success: false, message: 'Failed to create organization' });
  }
};

const updateOrganization = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name, ownerName, ownerPhone, plan, planExpiresAt,
      maxWorkspaces, maxUsersPerWorkspace, maxLeadsTotal,
      canUseWebhooks, canUsePDF, canUseCSVImport, canUseContentCalendar, canUseAdvancedReports,
      isActive, suspendedReason,
    } = req.body;

    const org = await Organization.findByPk(id);
    if (!org) return res.status(404).json({ success: false, message: 'Organization not found' });

    const updates = {};
    if (name) updates.name = name;
    if (ownerName) updates.ownerName = ownerName;
    if (ownerPhone) updates.ownerPhone = ownerPhone;
    if (plan) {
      updates.plan = plan;
      const planConfig = await Plan.findOne({ where: { name: plan } });
      if (planConfig) {
        updates.maxWorkspaces = maxWorkspaces ?? planConfig.maxWorkspaces;
        updates.maxUsersPerWorkspace = maxUsersPerWorkspace ?? planConfig.maxUsersPerWorkspace;
        updates.maxLeadsTotal = maxLeadsTotal ?? planConfig.maxLeadsTotal;
        updates.canUseWebhooks = canUseWebhooks ?? planConfig.canUseWebhooks;
        updates.canUsePDF = canUsePDF ?? planConfig.canUsePDF;
        updates.canUseCSVImport = canUseCSVImport ?? planConfig.canUseCSVImport;
        updates.canUseContentCalendar = canUseContentCalendar ?? planConfig.canUseContentCalendar;
        updates.canUseAdvancedReports = canUseAdvancedReports ?? planConfig.canUseAdvancedReports;
      }
    }
    if (planExpiresAt) updates.planExpiresAt = planExpiresAt;
    if (maxWorkspaces !== undefined) updates.maxWorkspaces = maxWorkspaces;
    if (maxUsersPerWorkspace !== undefined) updates.maxUsersPerWorkspace = maxUsersPerWorkspace;
    if (maxLeadsTotal !== undefined) updates.maxLeadsTotal = maxLeadsTotal;
    if (canUseWebhooks !== undefined) updates.canUseWebhooks = canUseWebhooks;
    if (canUsePDF !== undefined) updates.canUsePDF = canUsePDF;
    if (canUseCSVImport !== undefined) updates.canUseCSVImport = canUseCSVImport;
    if (canUseContentCalendar !== undefined) updates.canUseContentCalendar = canUseContentCalendar;
    if (canUseAdvancedReports !== undefined) updates.canUseAdvancedReports = canUseAdvancedReports;
    if (isActive !== undefined) updates.isActive = isActive;
    if (suspendedReason !== undefined) updates.suspendedReason = suspendedReason;

    await org.update(updates);
    res.json({ success: true, message: 'Organization updated', organization: org });
  } catch (err) {
    console.error('updateOrganization error:', err);
    res.status(500).json({ success: false, message: 'Failed to update organization' });
  }
};

const suspendOrganization = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const org = await Organization.findByPk(id);
    if (!org) return res.status(404).json({ success: false, message: 'Organization not found' });
    await org.update({ isSuspended: true, suspendedReason: reason || 'Account suspended by admin' });
    res.json({ success: true, message: 'Organization suspended' });
  } catch (err) {
    console.error('suspendOrganization error:', err);
    res.status(500).json({ success: false, message: 'Failed to suspend organization' });
  }
};

const unsuspendOrganization = async (req, res) => {
  try {
    const { id } = req.params;
    const org = await Organization.findByPk(id);
    if (!org) return res.status(404).json({ success: false, message: 'Organization not found' });
    await org.update({ isSuspended: false, suspendedReason: null });
    res.json({ success: true, message: 'Organization unsuspended' });
  } catch (err) {
    console.error('unsuspendOrganization error:', err);
    res.status(500).json({ success: false, message: 'Failed to unsuspend' });
  }
};

const deleteOrganization = async (req, res) => {
  try {
    const { id } = req.params;
    const org = await Organization.findByPk(id);
    if (!org) return res.status(404).json({ success: false, message: 'Organization not found' });
    await Promise.all([
      org.update({ isActive: false, isSuspended: true, suspendedReason: 'Organization deleted by super admin', slug: `${org.slug}-deleted-${id}` }),
      User.update({ isActive: false }, { where: { organizationId: id } }),
    ]);
    res.json({ success: true, message: 'Organization deactivated' });
  } catch (err) {
    console.error('deleteOrganization error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete organization' });
  }
};

const getPlans = async (req, res) => {
  try {
    const plans = await Plan.findAll({ order: [['price', 'ASC']] });
    res.json({ success: true, plans });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch plans' });
  }
};

const updatePlan = async (req, res) => {
  try {
    const { id } = req.params;
    const plan = await Plan.findByPk(id);
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
    const allowed = ['displayName', 'price', 'maxWorkspaces', 'maxUsersPerWorkspace', 'maxLeadsTotal',
      'canUseWebhooks', 'canUsePDF', 'canUseCSVImport', 'canUseContentCalendar', 'canUseAdvancedReports', 'description'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    await plan.update(updates);
    res.json({ success: true, message: 'Plan updated', plan });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update plan' });
  }
};

module.exports = {
  getDashboard, getOrganizations, getOrganization, createOrganization,
  updateOrganization, suspendOrganization, unsuspendOrganization, deleteOrganization,
  getPlans, updatePlan,
};
