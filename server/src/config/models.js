const { DataTypes } = require('sequelize');
const sequelize = require('./database');

// ─── PLAN ─────────────────────────────────────────────────────────────────
const Plan = sequelize.define('Plan', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  displayName: { type: DataTypes.STRING(100), allowNull: false },
  price: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  quarterlyPrice: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  halfYearlyPrice: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  yearlyPrice: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  maxWorkspaces: { type: DataTypes.INTEGER, defaultValue: 1 },
  maxUsersPerWorkspace: { type: DataTypes.INTEGER, defaultValue: 3 },
  maxLeadsTotal: { type: DataTypes.INTEGER, defaultValue: 100 },
  canUseWebhooks: { type: DataTypes.BOOLEAN, defaultValue: false },
  canUsePDF: { type: DataTypes.BOOLEAN, defaultValue: false },
  canUseCSVImport: { type: DataTypes.BOOLEAN, defaultValue: false },
  canUseContentCalendar: { type: DataTypes.BOOLEAN, defaultValue: false },
  canUseAdvancedReports: { type: DataTypes.BOOLEAN, defaultValue: false },
  canUseQuotations: { type: DataTypes.BOOLEAN, defaultValue: true },
  canUseInvoices: { type: DataTypes.BOOLEAN, defaultValue: true },
  canUseAppointments: { type: DataTypes.BOOLEAN, defaultValue: true },
  description: { type: DataTypes.TEXT },
  durationDays: { type: DataTypes.INTEGER, defaultValue: 30 },
}, { tableName: 'plans' });

// ─── ORGANIZATION ─────────────────────────────────────────────────────────
const Organization = sequelize.define('Organization', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(200), allowNull: false },
  slug: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  ownerEmail: { type: DataTypes.STRING(255), allowNull: false },
  ownerName: { type: DataTypes.STRING(200), allowNull: false },
  ownerPhone: { type: DataTypes.STRING(20) },
  plan: {
    type: DataTypes.ENUM('trial', 'starter', 'growth', 'agency', 'custom'),
    defaultValue: 'trial',
  },
  planExpiresAt: { type: DataTypes.DATE },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  isSuspended: { type: DataTypes.BOOLEAN, defaultValue: false },
  suspendedReason: { type: DataTypes.TEXT },
  maxWorkspaces: { type: DataTypes.INTEGER, defaultValue: 1 },
  maxUsersPerWorkspace: { type: DataTypes.INTEGER, defaultValue: 3 },
  maxLeadsPerWorkspace: { type: DataTypes.INTEGER, defaultValue: 100 },
  maxLeadsTotal: { type: DataTypes.INTEGER, defaultValue: 100 },
  canUseWebhooks: { type: DataTypes.BOOLEAN, defaultValue: false },
  canUsePDF: { type: DataTypes.BOOLEAN, defaultValue: false },
  canUseCSVImport: { type: DataTypes.BOOLEAN, defaultValue: false },
  canUseContentCalendar: { type: DataTypes.BOOLEAN, defaultValue: false },
  canUseAdvancedReports: { type: DataTypes.BOOLEAN, defaultValue: false },
  canUseQuotations: { type: DataTypes.BOOLEAN, defaultValue: true },
  canUseInvoices: { type: DataTypes.BOOLEAN, defaultValue: true },
  canUseAppointments: { type: DataTypes.BOOLEAN, defaultValue: true },
  webhookToken: { type: DataTypes.STRING(64), unique: true },
  settings: {
    type: DataTypes.JSON,
    defaultValue: {
      branding: {
        logo: null,
        companyName: '',
        address: '',
        gst: '',
        phone: '',
        email: '',
        website: '',
      },
      smtpConfig: null,
      messages: {
        quotationFooter: '',
        invoiceFooter: '',
      },
    },
  },
}, { tableName: 'organizations' });

// ─── WORKSPACE ────────────────────────────────────────────────────────────
const Workspace = sequelize.define('Workspace', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  organizationId: { type: DataTypes.INTEGER, allowNull: false },
  name: { type: DataTypes.STRING(200), allowNull: false },
  slug: { type: DataTypes.STRING(100), allowNull: false },
  description: { type: DataTypes.TEXT },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  webhookToken: { type: DataTypes.STRING(64), unique: true },
  settings: { type: DataTypes.JSON, defaultValue: {} },
}, {
  tableName: 'workspaces',
  indexes: [{ unique: true, fields: ['organizationId', 'slug'] }],
});

// ─── USER ─────────────────────────────────────────────────────────────────
const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  organizationId: { type: DataTypes.INTEGER, allowNull: true },
  workspaceId: { type: DataTypes.INTEGER, allowNull: true },
  name: { type: DataTypes.STRING(200), allowNull: false },
  email: { type: DataTypes.STRING(255), allowNull: false },
  password: { type: DataTypes.STRING(255), allowNull: false },
  role: {
    type: DataTypes.ENUM('superadmin', 'owner', 'admin', 'agent', 'designer', 'employee'),
    defaultValue: 'employee',
  },
  label: { type: DataTypes.STRING(100), allowNull: true },
  assignType: { type: DataTypes.ENUM('leads', 'tasks'), allowNull: true },
  canUseContentCalendar: { type: DataTypes.BOOLEAN, defaultValue: false },
  canAccessLeads: { type: DataTypes.BOOLEAN, defaultValue: true },
  phone: { type: DataTypes.STRING(20) },
  avatar: { type: DataTypes.STRING(255) },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  lastLogin: { type: DataTypes.DATE },
  passwordResetToken: { type: DataTypes.STRING(64), allowNull: true },
  passwordResetExpiry: { type: DataTypes.DATE, allowNull: true },
}, { tableName: 'users' });

// ─── EMPLOYEE LABEL ───────────────────────────────────────────────────────
const EmployeeLabel = sequelize.define('EmployeeLabel', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  organizationId: { type: DataTypes.INTEGER, allowNull: false },
  name: { type: DataTypes.STRING(50), allowNull: false },
  color: { type: DataTypes.STRING(7), defaultValue: '#6b7280' },
  isDefault: { type: DataTypes.BOOLEAN, defaultValue: false },
}, { tableName: 'employee_labels' });

// ─── LEAD ─────────────────────────────────────────────────────────────────
const Lead = sequelize.define('Lead', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  organizationId: { type: DataTypes.INTEGER, allowNull: false },
  workspaceId: { type: DataTypes.INTEGER, allowNull: false },
  name: { type: DataTypes.STRING(200), allowNull: false },
  phone: { type: DataTypes.STRING(50) },
  email: { type: DataTypes.STRING(255) },
  source: {
    type: DataTypes.ENUM(
      'Meta Ads', 'Google Ads', 'Website', 'WhatsApp', 'Reference', 'Justdial',
      'Telecalling', 'Social Media', 'CSV Import', 'Instagram DM', 'Quotation', 'Walk-in', 'Cold visit', 'Other'
    ),
    defaultValue: 'Other',
  },
  campaign: { type: DataTypes.STRING(255) },
  score: { type: DataTypes.INTEGER, defaultValue: 0 },
  priority: {
    type: DataTypes.ENUM('Hot', 'Warm', 'Cold'),
    defaultValue: 'Warm',
  },
  status: {
    type: DataTypes.ENUM('New', 'Discussion', 'Meeting', 'Quotation', 'Review', 'Won', 'Lost', 'Repeated'),
    defaultValue: 'New',
  },
  assignedTo: { type: DataTypes.INTEGER, allowNull: true },
  nextFollowup: { type: DataTypes.DATE },
  lastCallNote: { type: DataTypes.TEXT },
  city: { type: DataTypes.STRING(100) },
  clientAddress: { type: DataTypes.TEXT },
  clientGST: { type: DataTypes.STRING(20) },
  clientType: {
    type: DataTypes.ENUM(
      'Real Estate', 'Hospital', 'School', 'College',
      'Personal Branding', 'Construction', 'Other'
    ),
    defaultValue: 'Other',
  },
  designation: { type: DataTypes.STRING(200), allowNull: true },
  repeatCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  isDuplicate: { type: DataTypes.BOOLEAN, defaultValue: false },
  originalLeadId: { type: DataTypes.INTEGER, allowNull: true },
  isHot: { type: DataTypes.BOOLEAN, defaultValue: false },
  metadata: { type: DataTypes.JSON, defaultValue: {} },
}, { tableName: 'leads' });

// ─── LEAD ACTIVITY ────────────────────────────────────────────────────────
const LeadActivity = sequelize.define('LeadActivity', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  leadId: { type: DataTypes.INTEGER, allowNull: false },
  organizationId: { type: DataTypes.INTEGER, allowNull: false },
  workspaceId: { type: DataTypes.INTEGER, allowNull: false },
  userId: { type: DataTypes.INTEGER, allowNull: true },
  type: {
    type: DataTypes.ENUM(
      'created', 'call_logged', 'whatsapp_sent', 'email_sent',
      'status_changed', 'note_added', 'quotation_created',
      'invoice_generated', 'payment_received', 'followup_set',
      'duplicate_detected', 'assigned', 'csv_imported', 'webhook_received', 'viewed'
    ),
  },
  description: { type: DataTypes.TEXT },
  metadata: { type: DataTypes.JSON, defaultValue: {} },
}, { tableName: 'lead_activities' });

// ─── FOLLOWUP ─────────────────────────────────────────────────────────────
const Followup = sequelize.define('Followup', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  leadId: { type: DataTypes.INTEGER, allowNull: false },
  organizationId: { type: DataTypes.INTEGER, allowNull: false },
  workspaceId: { type: DataTypes.INTEGER, allowNull: false },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  scheduledAt: { type: DataTypes.DATE, allowNull: false },
  note: { type: DataTypes.TEXT },
  status: {
    type: DataTypes.ENUM('pending', 'completed', 'overdue', 'cancelled'),
    defaultValue: 'pending',
  },
  completedAt: { type: DataTypes.DATE },
  outcome: { type: DataTypes.TEXT },
  reminderSentAt: { type: DataTypes.DATE },
  onTimeReminderSentAt: { type: DataTypes.DATE },
}, { tableName: 'followups' });

// ─── CALL LOG ─────────────────────────────────────────────────────────────
const CallLog = sequelize.define('CallLog', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  leadId: { type: DataTypes.INTEGER, allowNull: false },
  organizationId: { type: DataTypes.INTEGER, allowNull: false },
  workspaceId: { type: DataTypes.INTEGER, allowNull: false },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  duration: { type: DataTypes.INTEGER, defaultValue: 0 },
  note: { type: DataTypes.TEXT },
  outcome: { type: DataTypes.STRING(255) },
  callType: {
    type: DataTypes.ENUM('outbound', 'inbound'),
    defaultValue: 'outbound',
  },
}, { tableName: 'call_logs' });

// ─── EMAIL LOG ────────────────────────────────────────────────────────────
const EmailLog = sequelize.define('EmailLog', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  leadId: { type: DataTypes.INTEGER, allowNull: false },
  organizationId: { type: DataTypes.INTEGER, allowNull: false },
  workspaceId: { type: DataTypes.INTEGER, allowNull: false },
  userId: { type: DataTypes.INTEGER, allowNull: true },
  subject: { type: DataTypes.STRING(500) },
  body: { type: DataTypes.TEXT },
  status: {
    type: DataTypes.ENUM('sent', 'failed', 'bounced'),
    defaultValue: 'sent',
  },
}, { tableName: 'email_logs' });

// ─── WHATSAPP LOG ─────────────────────────────────────────────────────────
const WhatsappLog = sequelize.define('WhatsappLog', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  leadId: { type: DataTypes.INTEGER, allowNull: false },
  organizationId: { type: DataTypes.INTEGER, allowNull: false },
  workspaceId: { type: DataTypes.INTEGER, allowNull: false },
  userId: { type: DataTypes.INTEGER, allowNull: true },
  message: { type: DataTypes.TEXT },
  direction: {
    type: DataTypes.ENUM('outbound', 'inbound'),
    defaultValue: 'outbound',
  },
  waMessageId: { type: DataTypes.STRING(100) },
}, { tableName: 'whatsapp_logs' });

// ─── APPOINTMENT ──────────────────────────────────────────────────────────
const Appointment = sequelize.define('Appointment', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  leadId: { type: DataTypes.INTEGER, allowNull: true },
  organizationId: { type: DataTypes.INTEGER, allowNull: false },
  workspaceId: { type: DataTypes.INTEGER, allowNull: false },
  createdBy: { type: DataTypes.INTEGER, allowNull: false },
  assignedTo: { type: DataTypes.INTEGER, allowNull: false },
  title: { type: DataTypes.STRING(255), allowNull: false },
  description: { type: DataTypes.TEXT },
  startTime: { type: DataTypes.DATE, allowNull: false },
  endTime: { type: DataTypes.DATE, allowNull: false },
  type: {
    type: DataTypes.ENUM('Call', 'Meeting', 'Demo', 'Site Visit', 'Follow-up', 'Other'),
    defaultValue: 'Meeting',
  },
  status: {
    type: DataTypes.ENUM('Scheduled', 'Completed', 'Cancelled', 'No Show'),
    defaultValue: 'Scheduled',
  },
  location: { type: DataTypes.TEXT },
  meetingLink: { type: DataTypes.TEXT },
  reminderSentAt: { type: DataTypes.DATE },
  notes: { type: DataTypes.TEXT },
}, { tableName: 'appointments' });

// ─── QUOTATION ────────────────────────────────────────────────────────────
const Quotation = sequelize.define('Quotation', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  organizationId: { type: DataTypes.INTEGER, allowNull: false },
  workspaceId: { type: DataTypes.INTEGER, allowNull: false },
  quotationNumber: { type: DataTypes.STRING(20), allowNull: false },
  title: { type: DataTypes.STRING(200), allowNull: true },
  leadId: { type: DataTypes.INTEGER, allowNull: true },
  createdBy: { type: DataTypes.INTEGER, allowNull: false },
  clientName: { type: DataTypes.STRING(200) },
  clientEmail: { type: DataTypes.STRING(255) },
  clientPhone: { type: DataTypes.STRING(20) },
  clientAddress: { type: DataTypes.TEXT },
  clientGST: { type: DataTypes.STRING(20) },
  status: {
    type: DataTypes.ENUM('Draft', 'Sent', 'Approved', 'Rejected', 'Not Responding'),
    defaultValue: 'Draft',
  },
  subtotal: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  gstPercent: { type: DataTypes.DECIMAL(5, 2), defaultValue: 18 },
  gstAmount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  totalAmount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  terms: { type: DataTypes.TEXT },
  validUntil: { type: DataTypes.DATEONLY },
  sentAt: { type: DataTypes.DATE },
  approvedAt: { type: DataTypes.DATE },
}, { tableName: 'quotations' });

// ─── QUOTATION ITEM ───────────────────────────────────────────────────────
const QuotationItem = sequelize.define('QuotationItem', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  quotationId: { type: DataTypes.INTEGER, allowNull: false },
  description: { type: DataTypes.STRING(255), allowNull: false },
  subDescription: { type: DataTypes.TEXT, allowNull: true },
  subItems: { type: DataTypes.JSON, defaultValue: [] },
  quantity: { type: DataTypes.DECIMAL(10, 2), defaultValue: 1 },
  unitPrice: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  totalPrice: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
}, { tableName: 'quotation_items' });

// ─── INVOICE ──────────────────────────────────────────────────────────────
const Invoice = sequelize.define('Invoice', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  organizationId: { type: DataTypes.INTEGER, allowNull: false },
  workspaceId: { type: DataTypes.INTEGER, allowNull: false },
  invoiceNumber: { type: DataTypes.STRING(20), allowNull: false },
  title: { type: DataTypes.STRING(200), allowNull: true },
  quotationId: { type: DataTypes.INTEGER, allowNull: true },
  leadId: { type: DataTypes.INTEGER, allowNull: true },
  createdBy: { type: DataTypes.INTEGER, allowNull: false },
  clientName: { type: DataTypes.STRING(200) },
  clientEmail: { type: DataTypes.STRING(255) },
  clientPhone: { type: DataTypes.STRING(20) },
  clientAddress: { type: DataTypes.TEXT },
  clientGST: { type: DataTypes.STRING(20) },
  subtotal: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  gstPercent: { type: DataTypes.DECIMAL(5, 2), defaultValue: 18 },
  gstAmount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  totalAmount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  paidAmount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  dueAmount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  status: {
    type: DataTypes.ENUM('Unpaid', 'Partial', 'Paid', 'Overdue'),
    defaultValue: 'Unpaid',
  },
  dueDate: { type: DataTypes.DATEONLY },
  lastReminderSentAt: { type: DataTypes.DATE, allowNull: true },
  terms: { type: DataTypes.TEXT },
  carryoverInvoices: { type: DataTypes.JSON, defaultValue: [] },
  carryoverTotal: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
}, { tableName: 'invoices' });

// ─── INVOICE ITEM ─────────────────────────────────────────────────────────
const InvoiceItem = sequelize.define('InvoiceItem', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  invoiceId: { type: DataTypes.INTEGER, allowNull: false },
  description: { type: DataTypes.STRING(255), allowNull: false },
  subDescription: { type: DataTypes.TEXT, allowNull: true },
  subItems: { type: DataTypes.JSON, defaultValue: [] },
  quantity: { type: DataTypes.DECIMAL(10, 2), defaultValue: 1 },
  unitPrice: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  totalPrice: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
}, { tableName: 'invoice_items' });

// ─── PAYMENT ──────────────────────────────────────────────────────────────
const Payment = sequelize.define('Payment', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  organizationId: { type: DataTypes.INTEGER, allowNull: false },
  workspaceId: { type: DataTypes.INTEGER, allowNull: false },
  invoiceId: { type: DataTypes.INTEGER, allowNull: false },
  leadId: { type: DataTypes.INTEGER, allowNull: true },
  receivedBy: { type: DataTypes.INTEGER, allowNull: false },
  amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  mode: {
    type: DataTypes.ENUM('UPI', 'Bank Transfer', 'Cash', 'Cheque', 'Online'),
    defaultValue: 'UPI',
  },
  reference: { type: DataTypes.STRING(100) },
  note: { type: DataTypes.TEXT },
  receivedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, { tableName: 'payments' });

// ─── EXPENSE ──────────────────────────────────────────────────────────────
const Expense = sequelize.define('Expense', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  organizationId: { type: DataTypes.INTEGER, allowNull: false },
  workspaceId: { type: DataTypes.INTEGER, allowNull: true },
  submittedBy: { type: DataTypes.INTEGER, allowNull: false },
  approvedBy: { type: DataTypes.INTEGER, allowNull: true },
  title: { type: DataTypes.STRING(255), allowNull: false },
  category: { type: DataTypes.STRING(100), defaultValue: 'Other' },
  amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  expenseDate: { type: DataTypes.DATEONLY, allowNull: false },
  billReference: { type: DataTypes.STRING(100), allowNull: true },
  receiptUrl: { type: DataTypes.STRING(500), allowNull: true },
  paymentMode: {
    type: DataTypes.ENUM('UPI', 'Bank Transfer', 'Cash', 'Cheque', 'Online', 'Card'),
    defaultValue: 'Cash',
  },
  notes: { type: DataTypes.TEXT, allowNull: true },
  status: {
    type: DataTypes.ENUM('Pending', 'Approved', 'Rejected'),
    defaultValue: 'Pending',
  },
  rejectionReason: { type: DataTypes.TEXT, allowNull: true },
}, { tableName: 'expenses' });

// ─── CONTENT TASK ─────────────────────────────────────────────────────────
const ContentTask = sequelize.define('ContentTask', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  organizationId: { type: DataTypes.INTEGER, allowNull: false },
  workspaceId: { type: DataTypes.INTEGER, allowNull: false },
  leadId: { type: DataTypes.INTEGER, allowNull: true },
  assignedTo: { type: DataTypes.INTEGER, allowNull: true },
  createdBy: { type: DataTypes.INTEGER, allowNull: false },
  title: { type: DataTypes.STRING(255), allowNull: false },
  description: { type: DataTypes.TEXT },
  priority: {
    type: DataTypes.ENUM('Low', 'Medium', 'High'),
    defaultValue: 'Medium',
  },
  status: {
    type: DataTypes.ENUM('Overdue', 'To Do Today', 'In Progress', 'Review', 'Approved', 'Not Approved', 'Pending', 'Done', 'Cancelled'),
    defaultValue: 'Overdue',
  },
  dueDate: { type: DataTypes.DATEONLY },
  dueTime: { type: DataTypes.STRING(5), allowNull: true },
  reminderSentAt: { type: DataTypes.DATE, allowNull: true },
  notes: { type: DataTypes.TEXT },
  assigneeNotes: { type: DataTypes.TEXT },
  scheduledFor: { type: DataTypes.DATE, allowNull: true },
  isArchived: { type: DataTypes.BOOLEAN, defaultValue: false },
  requiresApproval: { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'content_tasks' });

// ─── NOTIFICATION ─────────────────────────────────────────────────────────
const Notification = sequelize.define('Notification', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  organizationId: { type: DataTypes.INTEGER, allowNull: false },
  workspaceId: { type: DataTypes.INTEGER, allowNull: true },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  type: {
    type: DataTypes.ENUM(
      'lead_assigned', 'followup_due', 'quotation_approved',
      'payment_overdue', 'new_lead', 'appointment_reminder',
      'plan_expiring', 'workspace_limit_reached', 'system'
    ),
  },
  title: { type: DataTypes.STRING(255), allowNull: false },
  message: { type: DataTypes.TEXT, allowNull: false },
  data: { type: DataTypes.JSON, defaultValue: {} },
  isRead: { type: DataTypes.BOOLEAN, defaultValue: false },
  readAt: { type: DataTypes.DATE },
}, { tableName: 'notifications' });

// ─── WEBHOOK ROUTE ────────────────────────────────────────────────────────
const WebhookRoute = sequelize.define('WebhookRoute', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  organizationId: { type: DataTypes.INTEGER, allowNull: false },
  workspaceId: { type: DataTypes.INTEGER, allowNull: false },
  matchType: { type: DataTypes.ENUM('page_id', 'form_id'), allowNull: false },
  matchValue: { type: DataTypes.STRING(100), allowNull: false },
  label: { type: DataTypes.STRING(200) },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'webhook_routes' });

// ─── META INTEGRATION ─────────────────────────────────────────────────────
const MetaIntegration = sequelize.define('MetaIntegration', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  organizationId: { type: DataTypes.INTEGER, allowNull: false },
  workspaceId: { type: DataTypes.INTEGER, allowNull: false },
  fbPageId: { type: DataTypes.STRING(100), allowNull: false },
  fbPageName: { type: DataTypes.STRING(200) },
  accessToken: { type: DataTypes.TEXT, allowNull: false },
  tokenExpiresAt: { type: DataTypes.DATE },
  lastSyncAt: { type: DataTypes.DATE },
  syncStatus: { type: DataTypes.ENUM('idle', 'syncing', 'error'), defaultValue: 'idle' },
  lastSyncError: { type: DataTypes.TEXT },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  formRoutes: { type: DataTypes.JSON, defaultValue: [] },
}, { tableName: 'meta_integrations' });

// ─── USAGE LOG ────────────────────────────────────────────────────────────
const UsageLog = sequelize.define('UsageLog', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  organizationId: { type: DataTypes.INTEGER, allowNull: false },
  workspaceId: { type: DataTypes.INTEGER, allowNull: true },
  metric: {
    type: DataTypes.ENUM(
      'lead_created', 'user_created', 'workspace_created',
      'csv_imported', 'webhook_received', 'pdf_generated'
    ),
  },
  count: { type: DataTypes.INTEGER, defaultValue: 1 },
  loggedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, { tableName: 'usage_logs' });

// ─── ASSOCIATIONS ─────────────────────────────────────────────────────────

Organization.hasMany(Workspace, { foreignKey: 'organizationId', as: 'workspaces' });
Workspace.belongsTo(Organization, { foreignKey: 'organizationId', as: 'organization' });

Organization.hasMany(User, { foreignKey: 'organizationId', as: 'users' });
User.belongsTo(Organization, { foreignKey: 'organizationId', as: 'organization' });

Workspace.hasMany(User, { foreignKey: 'workspaceId', as: 'users' });
User.belongsTo(Workspace, { foreignKey: 'workspaceId', as: 'workspace' });

Organization.hasMany(Lead, { foreignKey: 'organizationId', as: 'leads' });
Lead.belongsTo(Organization, { foreignKey: 'organizationId', as: 'organization' });

Workspace.hasMany(Lead, { foreignKey: 'workspaceId', as: 'leads' });
Lead.belongsTo(Workspace, { foreignKey: 'workspaceId', as: 'workspace' });

User.hasMany(Lead, { foreignKey: 'assignedTo', as: 'assignedLeads' });
Lead.belongsTo(User, { foreignKey: 'assignedTo', as: 'assignedAgent' });

Lead.hasMany(LeadActivity, { foreignKey: 'leadId', as: 'activities' });
LeadActivity.belongsTo(Lead, { foreignKey: 'leadId', as: 'lead' });
LeadActivity.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Lead.hasMany(Followup, { foreignKey: 'leadId', as: 'followups' });
Followup.belongsTo(Lead, { foreignKey: 'leadId', as: 'lead' });
Followup.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Lead.hasMany(CallLog, { foreignKey: 'leadId', as: 'callLogs' });
CallLog.belongsTo(Lead, { foreignKey: 'leadId', as: 'lead' });
CallLog.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Lead.hasMany(EmailLog, { foreignKey: 'leadId', as: 'emailLogs' });
EmailLog.belongsTo(Lead, { foreignKey: 'leadId', as: 'lead' });

Lead.hasMany(WhatsappLog, { foreignKey: 'leadId', as: 'whatsappLogs' });
WhatsappLog.belongsTo(Lead, { foreignKey: 'leadId', as: 'lead' });

Lead.hasMany(Appointment, { foreignKey: 'leadId', as: 'appointments' });
Appointment.belongsTo(Lead, { foreignKey: 'leadId', as: 'lead' });
Appointment.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });
Appointment.belongsTo(User, { foreignKey: 'assignedTo', as: 'assignee' });

Lead.hasMany(Quotation, { foreignKey: 'leadId', as: 'quotations' });
Quotation.belongsTo(Lead, { foreignKey: 'leadId', as: 'lead' });
Quotation.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });
Quotation.hasMany(QuotationItem, { foreignKey: 'quotationId', as: 'items', onDelete: 'CASCADE' });
QuotationItem.belongsTo(Quotation, { foreignKey: 'quotationId', as: 'quotation' });

Quotation.hasOne(Invoice, { foreignKey: 'quotationId', as: 'invoice' });
Invoice.belongsTo(Quotation, { foreignKey: 'quotationId', as: 'quotation' });
Lead.hasMany(Invoice, { foreignKey: 'leadId', as: 'invoices' });
Invoice.belongsTo(Lead, { foreignKey: 'leadId', as: 'lead' });
Invoice.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });

Invoice.hasMany(InvoiceItem, { foreignKey: 'invoiceId', as: 'items', onDelete: 'CASCADE' });
InvoiceItem.belongsTo(Invoice, { foreignKey: 'invoiceId', as: 'invoice' });

Invoice.hasMany(Payment, { foreignKey: 'invoiceId', as: 'payments' });
Payment.belongsTo(Invoice, { foreignKey: 'invoiceId', as: 'invoice' });
Payment.belongsTo(User, { foreignKey: 'receivedBy', as: 'receiver' });

Lead.hasMany(ContentTask, { foreignKey: 'leadId', as: 'contentTasks' });
ContentTask.belongsTo(Lead, { foreignKey: 'leadId', as: 'lead' });

Expense.belongsTo(User, { foreignKey: 'submittedBy', as: 'submitter' });
Expense.belongsTo(User, { foreignKey: 'approvedBy', as: 'approver' });
Expense.belongsTo(Workspace, { foreignKey: 'workspaceId', as: 'workspace' });
User.hasMany(Expense, { foreignKey: 'submittedBy', as: 'expenses' });
ContentTask.belongsTo(User, { foreignKey: 'assignedTo', as: 'assignee' });
ContentTask.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });

User.hasMany(Notification, { foreignKey: 'userId', as: 'notifications' });
Notification.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Organization.hasMany(WebhookRoute, { foreignKey: 'organizationId', as: 'webhookRoutes' });
WebhookRoute.belongsTo(Organization, { foreignKey: 'organizationId', as: 'organization' });
Workspace.hasMany(WebhookRoute, { foreignKey: 'workspaceId', as: 'webhookRoutes' });
WebhookRoute.belongsTo(Workspace, { foreignKey: 'workspaceId', as: 'workspace' });

Organization.hasMany(MetaIntegration, { foreignKey: 'organizationId', as: 'metaIntegrations' });
MetaIntegration.belongsTo(Organization, { foreignKey: 'organizationId', as: 'organization' });
Workspace.hasMany(MetaIntegration, { foreignKey: 'workspaceId', as: 'metaIntegrations' });
MetaIntegration.belongsTo(Workspace, { foreignKey: 'workspaceId', as: 'workspace' });

const syncDatabase = async () => {
  try {
    // Create new tables only — does not alter existing tables (avoids MySQL key-limit errors)
    await sequelize.sync({ force: false });

    const qi = sequelize.getQueryInterface();

    // Add ownerPhone to organizations if missing
    try {
      const orgColumns = await qi.describeTable('organizations');
      if (!orgColumns.ownerPhone) {
        await qi.addColumn('organizations', 'ownerPhone', { type: DataTypes.STRING(20), allowNull: true });
      }
    } catch (e) { /* ignore */ }

    // Add webhookToken column if missing
    const wsColumns = await qi.describeTable('workspaces');
    if (!wsColumns.webhookToken) {
      await qi.addColumn('workspaces', 'webhookToken', {
        type: DataTypes.STRING(64), allowNull: true,
      });
    }

    // Add unique index on (organizationId, slug) if missing
    try {
      await qi.addIndex('workspaces', ['organizationId', 'slug'], { unique: true, name: 'workspaces_org_slug_unique' });
    } catch (e) {
      // Index already exists — ignore
    }

    // Add formRoutes column to meta_integrations if missing
    try {
      const miColumns = await qi.describeTable('meta_integrations');
      if (!miColumns.formRoutes) {
        await qi.addColumn('meta_integrations', 'formRoutes', { type: DataTypes.JSON, allowNull: true });
      }
    } catch (e) { /* table may not exist yet on first run */ }

    // Add reminderSentAt and onTimeReminderSentAt columns to followups if missing
    try {
      const fuColumns = await qi.describeTable('followups');
      if (!fuColumns.reminderSentAt) {
        await qi.addColumn('followups', 'reminderSentAt', { type: DataTypes.DATE, allowNull: true });
      }
      if (!fuColumns.onTimeReminderSentAt) {
        await qi.addColumn('followups', 'onTimeReminderSentAt', { type: DataTypes.DATE, allowNull: true });
      }
    } catch (e) { /* ignore */ }

    // Add password reset columns and employee fields to users if missing
    try {
      const userColumns = await qi.describeTable('users');
      if (!userColumns.passwordResetToken) {
        await qi.addColumn('users', 'passwordResetToken', { type: DataTypes.STRING(64), allowNull: true });
      }
      if (!userColumns.passwordResetExpiry) {
        await qi.addColumn('users', 'passwordResetExpiry', { type: DataTypes.DATE, allowNull: true });
      }
      if (!userColumns.label) {
        await qi.addColumn('users', 'label', { type: DataTypes.STRING(100), allowNull: true });
      }
      if (!userColumns.assignType) {
        await qi.addColumn('users', 'assignType', { type: DataTypes.ENUM('leads', 'tasks'), allowNull: true });
      }
      if (!userColumns.canUseContentCalendar) {
        await qi.addColumn('users', 'canUseContentCalendar', { type: DataTypes.BOOLEAN, defaultValue: false });
      }
      if (!userColumns.canAccessLeads) {
        await qi.addColumn('users', 'canAccessLeads', { type: DataTypes.BOOLEAN, defaultValue: true });
      }
      // Expand ENUM to include 'employee' then migrate legacy roles
      await sequelize.query(`ALTER TABLE users MODIFY role ENUM('superadmin','owner','admin','agent','designer','employee') NOT NULL DEFAULT 'employee'`);
      await sequelize.query(`UPDATE users SET label = 'Agent', role = 'employee' WHERE role = 'agent'`);
      await sequelize.query(`UPDATE users SET label = 'Designer', role = 'employee' WHERE role = 'designer'`);
    } catch (e) { console.error('User migration error:', e.message); }

    // Seed default employee labels per org if none exist
    try {
      const DEFAULT_LABELS = [
        { name: 'Agent', color: '#0ea5e9' },
        { name: 'Marketer', color: '#f59e0b' },
        { name: 'Designer', color: '#22c55e' },
        { name: 'Developer', color: '#8b5cf6' },
        { name: 'Sales', color: '#e94560' },
        { name: 'Support', color: '#06b6d4' },
      ];
      const { Organization: Org } = require('./models');
      const orgs = await sequelize.query('SELECT id FROM organizations WHERE isActive = 1', { type: sequelize.QueryTypes.SELECT });
      for (const org of orgs) {
        const existing = await EmployeeLabel.count({ where: { organizationId: org.id } });
        if (existing === 0) {
          await EmployeeLabel.bulkCreate(DEFAULT_LABELS.map(l => ({ ...l, organizationId: org.id, isDefault: true })));
        }
      }
    } catch (e) { /* ignore */ }

    // Expand quotations status ENUM to include 'Not Responding'
    try {
      await sequelize.query(`ALTER TABLE quotations MODIFY status ENUM('Draft','Sent','Approved','Rejected','Not Responding') NOT NULL DEFAULT 'Draft'`);
    } catch (e) { /* ignore */ }

    // Expand content_tasks status ENUM to include new workflow statuses
    try {
      await sequelize.query(`ALTER TABLE content_tasks MODIFY status ENUM('Overdue','To Do Today','In Progress','Review','Approved','Not Approved','Pending','Done','Cancelled') NOT NULL DEFAULT 'Overdue'`);
    } catch (e) { /* ignore */ }

    // Add priority and dueTime columns to content_tasks if missing
    try {
      const ctCols = await qi.describeTable('content_tasks');
      if (!ctCols.priority) {
        await qi.addColumn('content_tasks', 'priority', { type: DataTypes.ENUM('Low', 'Medium', 'High'), defaultValue: 'Medium', allowNull: true });
      }
      if (!ctCols.dueTime) {
        await qi.addColumn('content_tasks', 'dueTime', { type: DataTypes.STRING(5), allowNull: true });
      }
    } catch (e) { /* ignore */ }

    // Expand leads source ENUM (includes Cold visit)
    try {
      await sequelize.query(`ALTER TABLE leads MODIFY source ENUM('Meta Ads','Google Ads','Website','WhatsApp','Reference','Telecalling','Social Media','CSV Import','Instagram DM','Quotation','Justdial','Invoice','Walk-in','Cold visit','Other') DEFAULT 'Other'`);
    } catch (e) { /* ignore */ }

    // Add Review to leads status ENUM
    try {
      await sequelize.query(`ALTER TABLE leads MODIFY status ENUM('New','Discussion','Meeting','Quotation','Review','Won','Lost','Repeated') DEFAULT 'New'`);
    } catch (e) { /* ignore */ }

    // Migrate old lead priorities to new Hot/Warm/Cold system
    try {
      // Step 1: expand ENUM to include both old and new values so UPDATE can succeed
      await sequelize.query(`ALTER TABLE leads MODIFY priority ENUM('Low','Medium','High','Hot','Warm','Cold') DEFAULT 'Warm'`);
      // Step 2: migrate old values
      await sequelize.query(`UPDATE leads SET priority = 'Cold' WHERE priority = 'Low'`);
      await sequelize.query(`UPDATE leads SET priority = 'Warm' WHERE priority IN ('Medium','High')`);
      // Step 3: shrink to final ENUM (safe now that all rows have new values)
      await sequelize.query(`ALTER TABLE leads MODIFY priority ENUM('Hot','Warm','Cold') DEFAULT 'Warm'`);
    } catch (e) { /* ignore */ }

    // Add designation column to leads if missing
    try {
      const leadCols2 = await qi.describeTable('leads');
      if (!leadCols2.designation) {
        await qi.addColumn('leads', 'designation', { type: DataTypes.STRING(200), allowNull: true });
      }
    } catch (e) { /* ignore */ }

    // Add reminderSentAt column to content_tasks if missing
    try {
      const ctCols2 = await qi.describeTable('content_tasks');
      if (!ctCols2.reminderSentAt) {
        await qi.addColumn('content_tasks', 'reminderSentAt', { type: DataTypes.DATE, allowNull: true });
      }
    } catch (e) { /* ignore */ }

    // Add isArchived and requiresApproval to content_tasks if missing
    try {
      const ctCols3 = await qi.describeTable('content_tasks');
      if (!ctCols3.isArchived) {
        await qi.addColumn('content_tasks', 'isArchived', { type: DataTypes.BOOLEAN, defaultValue: false });
      }
      if (!ctCols3.requiresApproval) {
        await qi.addColumn('content_tasks', 'requiresApproval', { type: DataTypes.BOOLEAN, defaultValue: true });
      }
    } catch (e) { /* ignore */ }

    // Add city column to leads if missing
    try {
      const leadColumns = await qi.describeTable('leads');
      if (!leadColumns.city) {
        await qi.addColumn('leads', 'city', { type: DataTypes.STRING(100), allowNull: true });
      }
    } catch (e) { /* ignore */ }

    // Add subDescription and subItems to quotation_items and invoice_items if missing
    try {
      const qiCols = await qi.describeTable('quotation_items');
      if (!qiCols.subDescription) {
        await qi.addColumn('quotation_items', 'subDescription', { type: DataTypes.TEXT, allowNull: true });
      }
      if (!qiCols.subItems) {
        await qi.addColumn('quotation_items', 'subItems', { type: DataTypes.JSON, allowNull: true });
      }
    } catch (e) { /* ignore */ }

    try {
      const iiCols = await qi.describeTable('invoice_items');
      if (!iiCols.subDescription) {
        await qi.addColumn('invoice_items', 'subDescription', { type: DataTypes.TEXT, allowNull: true });
      }
      if (!iiCols.subItems) {
        await qi.addColumn('invoice_items', 'subItems', { type: DataTypes.JSON, allowNull: true });
      }
    } catch (e) { /* ignore */ }

    // Add lastReminderSentAt to invoices if missing
    try {
      const invCols = await qi.describeTable('invoices');
      if (!invCols.lastReminderSentAt) {
        await qi.addColumn('invoices', 'lastReminderSentAt', { type: DataTypes.DATE, allowNull: true });
      }
    } catch (e) { /* ignore */ }

    // Add carryover columns to invoices if missing
    try {
      const invCols2 = await qi.describeTable('invoices');
      if (!invCols2.carryoverInvoices) {
        await qi.addColumn('invoices', 'carryoverInvoices', { type: DataTypes.JSON, allowNull: true });
      }
      if (!invCols2.carryoverTotal) {
        await qi.addColumn('invoices', 'carryoverTotal', { type: DataTypes.DECIMAL(12, 2), defaultValue: 0, allowNull: true });
      }
    } catch (e) { /* ignore */ }

    // Add yearly/quarterly/halfYearly price columns to plans if missing
    try {
      const planCols = await qi.describeTable('plans');
      if (!planCols.yearlyPrice) {
        await qi.addColumn('plans', 'yearlyPrice', { type: DataTypes.DECIMAL(10, 2), defaultValue: 0, allowNull: true });
      }
      if (!planCols.quarterlyPrice) {
        await qi.addColumn('plans', 'quarterlyPrice', { type: DataTypes.DECIMAL(10, 2), defaultValue: 0, allowNull: true });
      }
      if (!planCols.halfYearlyPrice) {
        await qi.addColumn('plans', 'halfYearlyPrice', { type: DataTypes.DECIMAL(10, 2), defaultValue: 0, allowNull: true });
      }
    } catch (e) { /* ignore */ }

    // Expand lead_activities type ENUM to include 'viewed'
    try {
      await sequelize.query(`ALTER TABLE lead_activities MODIFY type ENUM('created','call_logged','whatsapp_sent','email_sent','status_changed','note_added','quotation_created','invoice_generated','payment_received','followup_set','duplicate_detected','assigned','csv_imported','webhook_received','viewed')`);
    } catch (e) { /* ignore */ }

    // Backfill city column from metadata for existing leads
    try {
      const leadsWithoutCity = await Lead.findAll({ where: { city: null }, attributes: ['id', 'metadata'] });
      for (const lead of leadsWithoutCity) {
        const meta = lead.metadata || {};
        let city = null;
        for (const k of Object.keys(meta)) {
          if (/^city$/i.test(k) && meta[k]) { city = meta[k]; break; }
        }
        if (!city && meta.rawFields) {
          for (const k of Object.keys(meta.rawFields)) {
            if (/^city$/i.test(k) && meta.rawFields[k]) { city = meta.rawFields[k]; break; }
          }
        }
        if (city) await lead.update({ city });
      }
    } catch (e) { /* ignore */ }

    // Auto-generate tokens for workspaces that don't have one
    const crypto = require('crypto');
    const unTokened = await Workspace.findAll({ where: { webhookToken: null } });
    for (const ws of unTokened) {
      await ws.update({ webhookToken: crypto.randomBytes(32).toString('hex') });
    }

    // Add assigneeNotes and scheduledFor columns to content_tasks if missing
    try {
      const ctCols4 = await qi.describeTable('content_tasks');
      if (!ctCols4.assigneeNotes) {
        await qi.addColumn('content_tasks', 'assigneeNotes', { type: DataTypes.TEXT, allowNull: true });
      }
      if (!ctCols4.scheduledFor) {
        await qi.addColumn('content_tasks', 'scheduledFor', { type: DataTypes.DATE, allowNull: true });
      }
    } catch (e) { /* ignore */ }

    // Add title column to quotations if missing
    try {
      const qCols = await qi.describeTable('quotations');
      if (!qCols.title) {
        await qi.addColumn('quotations', 'title', { type: DataTypes.STRING(200), allowNull: true });
      }
    } catch (e) { /* ignore */ }

    // Add title column to invoices if missing
    try {
      const invTitleCols = await qi.describeTable('invoices');
      if (!invTitleCols.title) {
        await qi.addColumn('invoices', 'title', { type: DataTypes.STRING(200), allowNull: true });
      }
    } catch (e) { /* ignore */ }

    // Fix expenses paymentMode ENUM and category to VARCHAR
    try {
      await sequelize.query(`ALTER TABLE expenses MODIFY category VARCHAR(100) NULL DEFAULT NULL`);
      await sequelize.query(`ALTER TABLE expenses MODIFY paymentMode ENUM('UPI','Bank Transfer','Cash','Cheque','Online','Card') NOT NULL DEFAULT 'Cash'`);
    } catch (e) { /* ignore */ }

    // Extend notifications ENUM to include expense types
    try {
      await sequelize.query(`ALTER TABLE notifications MODIFY type ENUM('lead_assigned','followup_due','quotation_approved','payment_overdue','new_lead','appointment_reminder','plan_expiring','workspace_limit_reached','system','expense_submitted','expense_approved','expense_rejected')`);
    } catch (e) { /* ignore */ }

    // Create expenses table if it doesn't exist
    try {
      await Expense.sync({ alter: false });
    } catch (e) { /* ignore */ }

    // Enforce global email uniqueness on users table
    try {
      await sequelize.query(`ALTER TABLE users ADD UNIQUE KEY users_email_unique (email)`);
    } catch (e) { /* ignore — constraint already exists or duplicate data present */ }

    console.log('Database synchronized successfully');
  } catch (err) {
    console.error('Database sync error:', err);
    throw err;
  }
};

module.exports = {
  sequelize,
  Plan,
  Organization,
  Workspace,
  User,
  Lead,
  LeadActivity,
  Followup,
  CallLog,
  EmailLog,
  WhatsappLog,
  Appointment,
  Quotation,
  QuotationItem,
  Invoice,
  InvoiceItem,
  Payment,
  Expense,
  ContentTask,
  Notification,
  UsageLog,
  WebhookRoute,
  MetaIntegration,
  EmployeeLabel,
  syncDatabase,
};
