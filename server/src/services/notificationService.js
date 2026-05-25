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
};
