const { Op } = require('sequelize');
const moment = require('moment-timezone');
const {
  sequelize, Appointment, Followup, Invoice, Quotation, ContentTask, Organization, User, Lead, MetaIntegration,
} = require('../config/models');
const { emitToUser } = require('../sockets');
const notificationService = require('./notificationService');
const emailService = require('./emailService');
const metaSyncService = require('./metaSyncService');

const IST = 'Asia/Kolkata';

const checkAppointmentReminders = async () => {
  try {
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 60 * 1000);
    const in31 = new Date(now.getTime() + 31 * 60 * 1000);

    const appointments = await Appointment.findAll({
      where: {
        status: 'Scheduled',
        startTime: { [Op.between]: [in30, in31] },
        reminderSentAt: null,
      },
    });

    for (const appt of appointments) {
      await notificationService.notifyAppointmentReminder({
        appointment: appt,
        userId: appt.assignedTo,
        organizationId: appt.organizationId,
        workspaceId: appt.workspaceId,
      });

      emitToUser(appt.assignedTo, 'appointment_reminder', {
        appointmentId: appt.id,
        title: appt.title,
        startTime: appt.startTime,
        message: `Appointment "${appt.title}" starts in 30 minutes`,
      });

      await appt.update({ reminderSentAt: new Date() });
    }
  } catch (err) {
    console.error('Appointment reminder check error:', err.message);
  }
};

const checkFollowupReminders = async () => {
  try {
    const now = new Date();
    // Remind exactly 5 minutes before: catch followups in the 4–6 minute window
    const in4 = new Date(now.getTime() + 4 * 60 * 1000);
    const in6 = new Date(now.getTime() + 6 * 60 * 1000);

    console.log(`[Scheduler] Checking followup reminders at ${now.toISOString()} | window: ${in4.toISOString()} → ${in6.toISOString()}`);

    const followups = await Followup.findAll({
      where: {
        status: 'pending',
        scheduledAt: { [Op.between]: [in4, in6] },
        reminderSentAt: null,
      },
      include: [{ model: Lead, as: 'lead', attributes: ['id', 'name'] }],
    });

    console.log(`[Scheduler] Found ${followups.length} followup(s) to remind`);

    for (const fu of followups) {
      const msg = `Followup with ${fu.lead?.name || 'a lead'} is in 5 minutes!`;
      console.log(`[Scheduler] Firing reminder for followup ${fu.id} → user ${fu.userId}, scheduledAt: ${fu.scheduledAt}`);

      emitToUser(fu.userId, 'followup_reminder', {
        followupId: fu.id,
        leadId: fu.leadId,
        leadName: fu.lead?.name,
        scheduledAt: fu.scheduledAt,
        note: fu.note,
        message: msg,
      });

      await notificationService.notifyFollowupDue({
        followup: fu,
        lead: fu.lead,
        userId: fu.userId,
        organizationId: fu.organizationId,
        workspaceId: fu.workspaceId,
      });

      await fu.update({ reminderSentAt: new Date() });
    }
  } catch (err) {
    console.error('Followup reminder check error:', err.message);
  }
};

const checkFollowupOnTimeReminders = async () => {
  try {
    const now = new Date();
    const minus1 = new Date(now.getTime() - 1 * 60 * 1000);
    const plus1 = new Date(now.getTime() + 1 * 60 * 1000);

    const followups = await Followup.findAll({
      where: {
        status: 'pending',
        scheduledAt: { [Op.between]: [minus1, plus1] },
        onTimeReminderSentAt: null,
      },
      include: [{ model: Lead, as: 'lead', attributes: ['id', 'name'] }],
    });

    for (const fu of followups) {
      const msg = `Followup with ${fu.lead?.name || 'a lead'} is due now!`;

      emitToUser(fu.userId, 'followup_reminder', {
        followupId: fu.id,
        leadId: fu.leadId,
        leadName: fu.lead?.name,
        scheduledAt: fu.scheduledAt,
        note: fu.note,
        message: msg,
      });

      await notificationService.notifyFollowupDue({
        followup: fu,
        lead: fu.lead,
        userId: fu.userId,
        organizationId: fu.organizationId,
        workspaceId: fu.workspaceId,
      });

      await fu.update({ onTimeReminderSentAt: new Date() });
    }
  } catch (err) {
    console.error('On-time followup reminder check error:', err.message);
  }
};

let dailyJobLastRun = null;

const runDailyJobs = async () => {
  const now = moment().tz(IST);
  const todayStr = now.format('YYYY-MM-DD');

  if (dailyJobLastRun === todayStr) return;
  if (now.hour() < 8) return;

  dailyJobLastRun = todayStr;
  console.log(`[Scheduler] Running daily jobs for ${todayStr}`);

  await sendDailyFollowupEmails();
  await markOverdueInvoices();
  await checkPlanExpiry();
  await markOverdueFollowups();
  await markOverdueTasks();
  await checkInvoicePaymentReminders();
  await checkQuotationExpiryEmails();
};

const sendDailyFollowupEmails = async () => {
  try {
    const startOfDay = moment().tz(IST).startOf('day').toDate();
    const endOfDay = moment().tz(IST).endOf('day').toDate();

    const followups = await Followup.findAll({
      where: {
        status: 'pending',
        scheduledAt: { [Op.between]: [startOfDay, endOfDay] },
      },
      include: [
        { model: Lead, as: 'lead', attributes: ['id', 'name', 'phone'] },
        { model: User, as: 'user', attributes: ['id', 'name', 'email', 'organizationId'] },
      ],
    });

    const byAgent = {};
    for (const fu of followups) {
      if (!fu.user) continue;
      if (!byAgent[fu.userId]) byAgent[fu.userId] = { user: fu.user, items: [], orgId: fu.organizationId };
      byAgent[fu.userId].items.push(fu);
    }

    for (const [, agentData] of Object.entries(byAgent)) {
      const org = await Organization.findByPk(agentData.orgId);
      const smtpConfig = org?.settings?.smtpConfig;
      const orgSettings = org?.settings;
      await emailService.sendFollowupReminderEmail(agentData.user, agentData.items, orgSettings, smtpConfig);
    }
    console.log(`[Scheduler] Sent followup emails to ${Object.keys(byAgent).length} agents`);
  } catch (err) {
    console.error('Daily followup email error:', err.message);
  }
};

const markOverdueInvoices = async () => {
  try {
    const today = moment().tz(IST).format('YYYY-MM-DD');
    const result = await Invoice.update(
      { status: 'Overdue' },
      {
        where: {
          status: { [Op.in]: ['Unpaid', 'Partial'] },
          dueDate: { [Op.lt]: today },
        },
      }
    );
    console.log(`[Scheduler] Marked ${result[0]} invoices as Overdue`);
  } catch (err) {
    console.error('Mark overdue invoices error:', err.message);
  }
};

const markOverdueFollowups = async () => {
  try {
    const now = new Date();
    const result = await Followup.update(
      { status: 'overdue' },
      {
        where: {
          status: 'pending',
          scheduledAt: { [Op.lt]: now },
        },
      }
    );
    console.log(`[Scheduler] Marked ${result[0]} followups as overdue`);
  } catch (err) {
    console.error('Mark overdue followups error:', err.message);
  }
};

const markOverdueTasks = async () => {
  try {
    // Tasks with dueTime: overdue when dueDate+dueTime < now
    const [withTime] = await sequelize.query(`
      UPDATE content_tasks
      SET status = 'Overdue'
      WHERE status NOT IN ('Approved', 'Done', 'Cancelled', 'Overdue')
        AND dueDate IS NOT NULL
        AND dueTime IS NOT NULL
        AND STR_TO_DATE(CONCAT(dueDate, ' ', dueTime), '%Y-%m-%d %H:%i') < NOW()
    `);

    // Tasks without dueTime: overdue when dueDate < today (end of day has passed)
    const [withoutTime] = await sequelize.query(`
      UPDATE content_tasks
      SET status = 'Overdue'
      WHERE status NOT IN ('Approved', 'Done', 'Cancelled', 'Overdue')
        AND dueDate IS NOT NULL
        AND (dueTime IS NULL OR dueTime = '')
        AND dueDate < CURDATE()
    `);

    console.log(`[Scheduler] Marked ${withTime + withoutTime} tasks as Overdue`);
  } catch (err) {
    console.error('Mark overdue tasks error:', err.message);
  }
};

const checkPlanExpiry = async () => {
  try {
    const in7days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const in1day = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000);

    const orgs = await Organization.findAll({
      where: {
        isActive: true,
        planExpiresAt: { [Op.between]: [new Date(), in7days] },
      },
      include: [{ model: User, as: 'users', where: { role: 'owner' }, required: false, attributes: ['id'] }],
    });

    for (const org of orgs) {
      const daysLeft = Math.ceil((new Date(org.planExpiresAt) - Date.now()) / (1000 * 60 * 60 * 24));
      const owner = org.users?.[0];
      if (owner) {
        await notificationService.notifyPlanExpiring({
          ownerId: owner.id,
          organizationId: org.id,
          daysLeft,
        });
      }
    }
  } catch (err) {
    console.error('Plan expiry check error:', err.message);
  }
};

const checkTaskReminders = async () => {
  try {
    const now = new Date();
    const in4 = new Date(now.getTime() + 4 * 60 * 1000);
    const in6 = new Date(now.getTime() + 6 * 60 * 1000);
    const todayIST = moment().tz(IST).format('YYYY-MM-DD');
    const nowTimeIST = moment().tz(IST).format('HH:mm');
    const in5TimeIST = moment().tz(IST).add(5, 'minutes').format('HH:mm');

    const tasks = await ContentTask.findAll({
      where: {
        dueDate: todayIST,
        dueTime: { [Op.between]: [nowTimeIST, in5TimeIST] },
        reminderSentAt: null,
        status: { [Op.notIn]: ['Approved', 'Done', 'Cancelled'] },
      },
      include: [{ model: User, as: 'assignee', attributes: ['id', 'name'] }],
    });

    for (const task of tasks) {
      if (!task.assignedTo) continue;
      emitToUser(task.assignedTo, 'task_reminder', {
        taskId: task.id,
        title: task.title,
        dueDate: task.dueDate,
        dueTime: task.dueTime,
        message: `Task "${task.title}" is due in 5 minutes!`,
      });
      await task.update({ reminderSentAt: new Date() });
    }
  } catch (err) {
    console.error('Task reminder check error:', err.message);
  }
};

const checkInvoicePaymentReminders = async () => {
  try {
    const today = moment().tz(IST);

    // All unpaid/partial/overdue invoices that have a client email
    const invoices = await Invoice.findAll({
      where: {
        status: { [Op.in]: ['Unpaid', 'Partial', 'Overdue'] },
        clientEmail: { [Op.not]: null },
      },
    });

    for (const inv of invoices) {
      const org = await Organization.findByPk(inv.organizationId);
      if (!org?.settings?.smtpConfig) continue;

      const lastSent = inv.lastReminderSentAt ? moment(inv.lastReminderSentAt).tz(IST) : null;
      const daysSinceLastSent = lastSent ? today.diff(lastSent, 'days') : Infinity;

      let shouldSend = false;

      if (inv.dueDate) {
        const daysUntilDue = moment(inv.dueDate).tz(IST).diff(today, 'days');
        // Trigger on specific milestone days before/on due date
        const milestones = [7, 3, 1, 0];
        if (milestones.includes(daysUntilDue)) {
          // Only send once per milestone (not already sent today)
          if (daysSinceLastSent >= 1) shouldSend = true;
        }
        // After due date: send every 7 days until paid
        if (daysUntilDue < 0 && daysSinceLastSent >= 7) {
          shouldSend = true;
        }
      } else {
        // No due date: send once on creation day, then every 7 days
        if (daysSinceLastSent >= 7) shouldSend = true;
      }

      if (!shouldSend) continue;

      try {
        await emailService.sendInvoiceDueReminder(inv, org.settings, org.settings.smtpConfig);
        await inv.update({ lastReminderSentAt: new Date() });
        console.log(`[Scheduler] Invoice reminder sent for ${inv.invoiceNumber} to ${inv.clientEmail}`);
      } catch (e) {
        console.error(`[Scheduler] Failed to send invoice reminder for ${inv.invoiceNumber}:`, e.message);
      }
    }
  } catch (err) {
    console.error('Invoice payment reminder error:', err.message);
  }
};

const checkQuotationExpiryEmails = async () => {
  try {
    const todayIST = moment().tz(IST).format('YYYY-MM-DD');
    const quotations = await Quotation.findAll({
      where: {
        validUntil: todayIST,
        status: { [Op.in]: ['Draft', 'Sent'] },
        clientEmail: { [Op.ne]: null },
      },
    });

    for (const q of quotations) {
      const org = await Organization.findByPk(q.organizationId);
      if (!org?.settings?.smtpConfig) continue;
      await emailService.sendQuotationExpiryReminder(q, org.settings, org.settings.smtpConfig);
    }
  } catch (err) {
    console.error('Quotation expiry email error:', err.message);
  }
};

const startScheduler = () => {
  // On every startup: reset any integrations stuck in 'syncing' from a previous crash/restart,
  // then run an immediate sync so leads from the downtime window aren't delayed 60 seconds.
  MetaIntegration.update({ syncStatus: 'idle' }, { where: { syncStatus: 'syncing' } })
    .then(([count]) => {
      if (count > 0) console.log(`[Scheduler] Reset ${count} stuck Meta integration(s) to idle`);
      return metaSyncService.syncAllIntegrations();
    })
    .catch(err => console.error('[Scheduler] Startup Meta sync error:', err.message));

  setInterval(checkAppointmentReminders, 60 * 1000);
  setInterval(checkFollowupReminders, 60 * 1000);
  setInterval(checkFollowupOnTimeReminders, 60 * 1000);
  setInterval(checkTaskReminders, 60 * 1000);
  checkFollowupReminders();
  setInterval(runDailyJobs, 60 * 1000);
  setInterval(metaSyncService.syncAllIntegrations, 60 * 1000);
  console.log('[Scheduler] Background jobs started');
};

module.exports = { startScheduler, checkAppointmentReminders, checkFollowupReminders, runDailyJobs };
