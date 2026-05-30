const { Op } = require('sequelize');
const moment = require('moment-timezone');
const {
  Appointment, Followup, Invoice, Organization, User, Lead, MetaIntegration,
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
  checkFollowupReminders();
  setInterval(runDailyJobs, 60 * 1000);
  setInterval(metaSyncService.syncAllIntegrations, 60 * 1000);
  console.log('[Scheduler] Background jobs started');
};

module.exports = { startScheduler, checkAppointmentReminders, checkFollowupReminders, runDailyJobs };
