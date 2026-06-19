const { Op } = require('sequelize');
const { Notification } = require('../config/models');
const { emitToUser, emitToWorkspace } = require('../sockets');

const create = async ({ organizationId, workspaceId, userId, type, title, message, data = {} }) => {
  try {
    const notification = await Notification.create({
      organizationId,
      workspaceId: workspaceId || null,
      userId,
      type,
      title,
      message,
      data,
      isRead: false,
    });

    emitToUser(userId, 'notification', {
      id: notification.id,
      type,
      title,
      message,
      data,
      createdAt: notification.createdAt,
    });

    return notification;
  } catch (err) {
    console.error('Notification create error:', err.message);
    return null;
  }
};

const notifyLeadAssigned = async ({ lead, assignedUser, organizationId, workspaceId }) => {
  if (!assignedUser) return;
  return create({
    organizationId,
    workspaceId,
    userId: assignedUser.id,
    type: 'lead_assigned',
    title: 'New Lead Assigned',
    message: `${lead.name} has been assigned to you`,
    data: { leadId: lead.id, leadName: lead.name },
  });
};

const notifyNewLead = async ({ lead, adminIds, organizationId, workspaceId }) => {
  const promises = (adminIds || []).map((userId) =>
    create({
      organizationId, workspaceId, userId,
      type: 'new_lead',
      title: 'New Lead Arrived',
      message: `${lead.name} arrived via ${lead.source}`,
      data: { leadId: lead.id, leadName: lead.name, source: lead.source },
    })
  );
  return Promise.all(promises);
};

const notifyQuotationApproved = async ({ quotation, creatorId, organizationId, workspaceId }) => {
  return create({
    organizationId, workspaceId, userId: creatorId,
    type: 'quotation_approved',
    title: 'Quotation Approved',
    message: `Quotation ${quotation.quotationNumber} has been approved`,
    data: { quotationId: quotation.id, quotationNumber: quotation.quotationNumber },
  });
};

const notifyPaymentReceived = async ({ payment, invoice, adminIds, organizationId, workspaceId }) => {
  const promises = (adminIds || []).map((userId) =>
    create({
      organizationId, workspaceId, userId,
      type: 'payment_received',
      title: 'Payment Received',
      message: `₹${parseFloat(payment.amount).toLocaleString('en-IN')} received for invoice ${invoice.invoiceNumber}`,
      data: { paymentId: payment.id, invoiceId: invoice.id, amount: payment.amount },
    })
  );
  return Promise.all(promises);
};

const notifyFollowupDue = async ({ followup, lead, userId, organizationId, workspaceId }) => {
  return create({
    organizationId, workspaceId, userId,
    type: 'followup_due',
    title: 'Followup Due',
    message: `Followup with ${lead?.name || 'a lead'} is due now`,
    data: { followupId: followup.id, leadId: followup.leadId },
  });
};

const notifyAppointmentReminder = async ({ appointment, userId, organizationId, workspaceId }) => {
  return create({
    organizationId, workspaceId, userId,
    type: 'appointment_reminder',
    title: 'Appointment in 30 minutes',
    message: `${appointment.title} starts in 30 minutes`,
    data: { appointmentId: appointment.id },
  });
};

const notifyPlanExpiring = async ({ ownerId, organizationId, daysLeft }) => {
  // Suppress if a notification was already sent in the last 4 hours (survives restarts)
  const since = new Date(Date.now() - 4 * 60 * 60 * 1000);
  const recent = await Notification.findOne({
    where: { userId: ownerId, type: 'plan_expiring', createdAt: { [Op.gte]: since } },
  });
  if (recent) return null;

  return create({
    organizationId, workspaceId: null, userId: ownerId,
    type: 'plan_expiring',
    title: 'Subscription Expiring Soon',
    message: `Your plan expires in ${daysLeft} day(s). Please renew to continue using the platform.`,
    data: { daysLeft },
  });
};

const notifyWorkspaceLimitReached = async ({ ownerId, organizationId, limitType }) => {
  return create({
    organizationId, workspaceId: null, userId: ownerId,
    type: 'workspace_limit_reached',
    title: 'Plan Limit Reached',
    message: `You have reached the ${limitType} limit on your current plan.`,
    data: { limitType },
  });
};

const notifyExpenseSubmitted = async ({ expense, submitter }) => {
  try {
    const { User } = require('../config/models');
    const approvers = await User.findAll({
      where: { organizationId: expense.organizationId, role: { [require('sequelize').Op.in]: ['admin', 'owner'] } },
      attributes: ['id'],
    });
    const promises = approvers
      .filter(u => u.id !== submitter.id)
      .map(u => create({
        organizationId: expense.organizationId,
        workspaceId: expense.workspaceId || null,
        userId: u.id,
        type: 'expense_submitted',
        title: 'New Expense Submitted',
        message: `${submitter.name} submitted an expense: ${expense.title} (₹${parseFloat(expense.amount).toLocaleString('en-IN')})`,
        data: { expenseId: expense.id },
      }));
    return Promise.all(promises);
  } catch (err) {
    console.error('notifyExpenseSubmitted error:', err.message);
  }
};

const notifyExpenseApproved = async ({ expense, approver }) => {
  return create({
    organizationId: expense.organizationId,
    workspaceId: expense.workspaceId || null,
    userId: expense.submittedBy,
    type: 'expense_approved',
    title: 'Expense Approved',
    message: `Your expense "${expense.title}" (₹${parseFloat(expense.amount).toLocaleString('en-IN')}) has been approved by ${approver.name}`,
    data: { expenseId: expense.id },
  });
};

const notifyExpenseRejected = async ({ expense, approver, reason }) => {
  return create({
    organizationId: expense.organizationId,
    workspaceId: expense.workspaceId || null,
    userId: expense.submittedBy,
    type: 'expense_rejected',
    title: 'Expense Rejected',
    message: `Your expense "${expense.title}" was rejected by ${approver.name}${reason ? `: ${reason}` : ''}`,
    data: { expenseId: expense.id, reason },
  });
};

module.exports = {
  create,
  notifyLeadAssigned,
  notifyNewLead,
  notifyQuotationApproved,
  notifyPaymentReceived,
  notifyFollowupDue,
  notifyAppointmentReminder,
  notifyPlanExpiring,
  notifyWorkspaceLimitReached,
  notifyExpenseSubmitted,
  notifyExpenseApproved,
  notifyExpenseRejected,
};
