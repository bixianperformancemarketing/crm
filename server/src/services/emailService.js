const nodemailer = require('nodemailer');
const moment = require('moment-timezone');

const IST = 'Asia/Kolkata';

const getTransporter = (smtpConfig) => {
  const config = smtpConfig || {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  };
  return nodemailer.createTransport({
    host: config.host,
    port: config.port || 587,
    secure: config.port === 465,
    auth: { user: config.user || config.auth?.user, pass: config.pass || config.auth?.pass },
    tls: { rejectUnauthorized: false },
  });
};

const getFromAddress = (smtpConfig) => {
  const name = smtpConfig?.fromName || process.env.FROM_NAME || 'CRM Platform';
  const email = smtpConfig?.fromEmail || process.env.FROM_EMAIL || process.env.SMTP_USER;
  return `"${name}" <${email}>`;
};

const baseTemplate = (title, content, orgSettings) => {
  const companyName = orgSettings?.branding?.companyName || process.env.COMPANY_NAME || 'CRM Platform';
  const year = new Date().getFullYear();
  return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; margin: 0; padding: 0; }
  .container { max-width: 600px; margin: 30px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
  .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 30px 40px; }
  .header h1 { color: #e94560; margin: 0; font-size: 24px; }
  .header p { color: #a0a0b0; margin: 5px 0 0; font-size: 14px; }
  .body { padding: 30px 40px; color: #333; }
  .body h2 { color: #1a1a2e; margin-top: 0; }
  .info-box { background: #f8f9fa; border-left: 4px solid #e94560; padding: 15px 20px; border-radius: 4px; margin: 20px 0; }
  .info-row { display: flex; margin: 8px 0; }
  .info-label { font-weight: 600; color: #555; min-width: 140px; }
  .info-value { color: #333; }
  .btn { display: inline-block; background: #e94560; color: #ffffff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; margin: 20px 0; }
  .footer { background: #f8f9fa; padding: 20px 40px; text-align: center; color: #888; font-size: 12px; border-top: 1px solid #eee; }
  table.items { width: 100%; border-collapse: collapse; margin: 20px 0; }
  table.items th { background: #1a1a2e; color: #fff; padding: 10px 12px; text-align: left; font-size: 13px; }
  table.items td { padding: 10px 12px; border-bottom: 1px solid #eee; font-size: 13px; }
  table.items tr:last-child td { border-bottom: none; }
  .total-row td { font-weight: 700; background: #f8f9fa; }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>${companyName}</h1>
    <p>${title}</p>
  </div>
  <div class="body">
    ${content}
  </div>
  <div class="footer">
    <p>© ${year} ${companyName}. All rights reserved.</p>
    <p>This is an automated email. Please do not reply directly.</p>
  </div>
</div>
</body>
</html>`;
};

const sendEmail = async ({ to, subject, html, attachments = [], smtpConfig, orgSettings }) => {
  try {
    const transporter = getTransporter(smtpConfig);
    const from = getFromAddress(smtpConfig);
    await transporter.sendMail({ from, to, subject, html, attachments });
    return { success: true };
  } catch (err) {
    console.error('Email send error:', err.message);
    return { success: false, error: err.message };
  }
};

const sendLeadAcknowledgement = async (lead, orgSettings, smtpConfig) => {
  const companyName = orgSettings?.branding?.companyName || process.env.COMPANY_NAME;
  const phone = orgSettings?.branding?.phone || process.env.COMPANY_PHONE;
  const content = `
    <h2>Thank you for your interest, ${lead.name}!</h2>
    <p>We've received your inquiry and one of our team members will get in touch with you shortly.</p>
    <div class="info-box">
      <div class="info-row"><span class="info-label">Name:</span><span class="info-value">${lead.name}</span></div>
      <div class="info-row"><span class="info-label">Phone:</span><span class="info-value">${lead.phone || 'N/A'}</span></div>
      <div class="info-row"><span class="info-label">Reference:</span><span class="info-value">${lead.id}</span></div>
    </div>
    <p>For urgent queries, contact us at: <strong>${phone || ''}</strong></p>
  `;
  if (!lead.email) return;
  return sendEmail({
    to: lead.email,
    subject: `Thank you for contacting ${companyName} - We'll be in touch!`,
    html: baseTemplate('Inquiry Confirmation', content, orgSettings),
    smtpConfig,
    orgSettings,
  });
};

const sendQuotationEmail = async (quotation, items, pdfBuffer, orgSettings, smtpConfig) => {
  const content = `
    <h2>Quotation #${quotation.quotationNumber}</h2>
    <p>Dear ${quotation.clientName},</p>
    <p>Please find your quotation attached. Here is a summary:</p>
    <table class="items">
      <thead><tr><th>Description</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
      <tbody>
        ${items.map((i) => `
          <tr>
            <td>${i.description}</td>
            <td>${i.quantity}</td>
            <td>₹${parseFloat(i.unitPrice).toLocaleString('en-IN')}</td>
            <td>₹${parseFloat(i.totalPrice).toLocaleString('en-IN')}</td>
          </tr>`).join('')}
        <tr class="total-row">
          <td colspan="3">Subtotal</td><td>₹${parseFloat(quotation.subtotal).toLocaleString('en-IN')}</td>
        </tr>
        <tr class="total-row">
          <td colspan="3">GST (${quotation.gstPercent}%)</td><td>₹${parseFloat(quotation.gstAmount).toLocaleString('en-IN')}</td>
        </tr>
        <tr class="total-row">
          <td colspan="3">Total Amount</td><td>₹${parseFloat(quotation.totalAmount).toLocaleString('en-IN')}</td>
        </tr>
      </tbody>
    </table>
    ${quotation.validUntil ? `<p>This quotation is valid until <strong>${moment(quotation.validUntil).tz(IST).format('DD MMM YYYY')}</strong>.</p>` : ''}
    ${quotation.terms ? `<p><strong>Terms:</strong> ${quotation.terms}</p>` : ''}
    <p>For any queries, please contact us.</p>
  `;
  return sendEmail({
    to: quotation.clientEmail,
    subject: `Quotation #${quotation.quotationNumber} from ${orgSettings?.branding?.companyName || 'Us'}`,
    html: baseTemplate(`Quotation #${quotation.quotationNumber}`, content, orgSettings),
    attachments: pdfBuffer ? [{ filename: `${quotation.quotationNumber}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }] : [],
    smtpConfig,
    orgSettings,
  });
};

const sendInvoiceDueReminder = async (invoice, orgSettings, smtpConfig) => {
  if (!invoice.clientEmail) return;
  const daysUntilDue = moment(invoice.dueDate).tz(IST).diff(moment().tz(IST), 'days');
  const content = `
    <h2>Payment Reminder - Invoice #${invoice.invoiceNumber}</h2>
    <p>Dear ${invoice.clientName},</p>
    <p>This is a reminder that invoice #${invoice.invoiceNumber} ${daysUntilDue <= 0 ? 'is <strong>overdue</strong>' : `is due in <strong>${daysUntilDue} day(s)</strong>`}.</p>
    <div class="info-box">
      <div class="info-row"><span class="info-label">Invoice:</span><span class="info-value">${invoice.invoiceNumber}</span></div>
      <div class="info-row"><span class="info-label">Total Amount:</span><span class="info-value">₹${parseFloat(invoice.totalAmount).toLocaleString('en-IN')}</span></div>
      <div class="info-row"><span class="info-label">Amount Due:</span><span class="info-value">₹${parseFloat(invoice.dueAmount).toLocaleString('en-IN')}</span></div>
      <div class="info-row"><span class="info-label">Due Date:</span><span class="info-value">${moment(invoice.dueDate).tz(IST).format('DD MMM YYYY')}</span></div>
    </div>
    <p>Please make the payment at your earliest convenience to avoid any disruption to services.</p>
  `;
  return sendEmail({
    to: invoice.clientEmail,
    subject: `Payment Reminder - Invoice #${invoice.invoiceNumber}`,
    html: baseTemplate('Payment Reminder', content, orgSettings),
    smtpConfig,
    orgSettings,
  });
};

const sendFollowupReminderEmail = async (user, followups, orgSettings, smtpConfig) => {
  if (!user.email || !followups.length) return;
  const followupRows = followups.map((f) => `
    <tr>
      <td>${f.lead?.name || 'N/A'}</td>
      <td>${moment(f.scheduledAt).tz(IST).format('hh:mm A')}</td>
      <td>${f.note || '-'}</td>
    </tr>`).join('');
  const content = `
    <h2>Good Morning, ${user.name}!</h2>
    <p>You have <strong>${followups.length}</strong> followup(s) scheduled for today:</p>
    <table class="items">
      <thead><tr><th>Lead Name</th><th>Time</th><th>Note</th></tr></thead>
      <tbody>${followupRows}</tbody>
    </table>
    <p>Have a productive day!</p>
  `;
  return sendEmail({
    to: user.email,
    subject: `Your ${followups.length} Followup(s) for Today - ${moment().tz(IST).format('DD MMM YYYY')}`,
    html: baseTemplate("Today's Followups", content, orgSettings),
    smtpConfig,
    orgSettings,
  });
};

const sendAppointmentReminder = async (appointment, user, orgSettings, smtpConfig) => {
  if (!user.email) return;
  const content = `
    <h2>Appointment Reminder</h2>
    <p>Dear ${user.name},</p>
    <p>You have an appointment starting in <strong>1 hour</strong>:</p>
    <div class="info-box">
      <div class="info-row"><span class="info-label">Title:</span><span class="info-value">${appointment.title}</span></div>
      <div class="info-row"><span class="info-label">Type:</span><span class="info-value">${appointment.type}</span></div>
      <div class="info-row"><span class="info-label">Start Time:</span><span class="info-value">${moment(appointment.startTime).tz(IST).format('DD MMM YYYY, hh:mm A')}</span></div>
      ${appointment.location ? `<div class="info-row"><span class="info-label">Location:</span><span class="info-value">${appointment.location}</span></div>` : ''}
      ${appointment.meetingLink ? `<div class="info-row"><span class="info-label">Meeting Link:</span><span class="info-value"><a href="${appointment.meetingLink}">${appointment.meetingLink}</a></span></div>` : ''}
    </div>
    ${appointment.description ? `<p>${appointment.description}</p>` : ''}
  `;
  return sendEmail({
    to: user.email,
    subject: `Reminder: ${appointment.title} starting in 1 hour`,
    html: baseTemplate('Appointment Reminder', content, orgSettings),
    smtpConfig,
    orgSettings,
  });
};

const sendCustomEmail = async ({ to, subject, body, orgSettings, smtpConfig }) => {
  const content = `<div style="white-space:pre-wrap; color:#333; line-height:1.6;">${body.replace(/\n/g, '<br>')}</div>`;
  return sendEmail({
    to,
    subject,
    html: baseTemplate(subject, content, orgSettings),
    smtpConfig,
    orgSettings,
  });
};

const sendWelcomeEmail = async (ownerEmail, ownerName, orgName, tempPassword) => {
  const content = `
    <h2>Welcome to Agency CRM, ${ownerName}!</h2>
    <p>Your organization <strong>${orgName}</strong> has been created. Use the credentials below to log in.</p>
    <div class="info-box">
      <div class="info-row"><span class="info-label">Email:</span><span class="info-value">${ownerEmail}</span></div>
      <div class="info-row"><span class="info-label">Temporary Password:</span><span class="info-value" style="font-family:monospace;font-size:16px;font-weight:700;">${tempPassword}</span></div>
    </div>
    <p style="color:#e05a1e;"><strong>Please change your password immediately after logging in.</strong></p>
    <a href="${process.env.CLIENT_URL || 'http://localhost'}/login" class="btn">Login Now</a>
    <p style="font-size:12px;color:#888;margin-top:20px;">If you did not request this account, please contact your administrator.</p>
  `;
  return sendEmail({
    to: ownerEmail,
    subject: `Welcome to Agency CRM — Your Account is Ready`,
    html: baseTemplate('Welcome to Agency CRM', content, { branding: { companyName: 'Agency CRM' } }),
  });
};

const sendPasswordResetEmail = async (toEmail, userName, resetLink) => {
  const content = `
    <h2>Password Reset Request</h2>
    <p>Hi ${userName},</p>
    <p>We received a request to reset your password. Click the button below to set a new password. This link is valid for <strong>1 hour</strong>.</p>
    <a href="${resetLink}" class="btn">Reset Password</a>
    <p style="margin-top:20px;font-size:13px;color:#666;">Or copy this link:<br><a href="${resetLink}" style="color:#e94560;word-break:break-all;">${resetLink}</a></p>
    <p style="font-size:12px;color:#888;margin-top:20px;">If you did not request a password reset, you can safely ignore this email.</p>
  `;
  return sendEmail({
    to: toEmail,
    subject: 'Reset Your CRM Password',
    html: baseTemplate('Password Reset', content, { branding: { companyName: 'Agency CRM' } }),
  });
};

const sendInvoiceEmail = async (invoice, items, pdfBuffer, orgSettings, smtpConfig) => {
  const content = `
    <h2>Invoice #${invoice.invoiceNumber}</h2>
    <p>Dear ${invoice.clientName},</p>
    <p>Please find your invoice attached. Here is a summary:</p>
    <table class="items">
      <thead><tr><th>Description</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
      <tbody>
        ${items.map((i) => `
          <tr>
            <td>${i.description}</td>
            <td>${i.quantity}</td>
            <td>₹${parseFloat(i.unitPrice).toLocaleString('en-IN')}</td>
            <td>₹${parseFloat(i.totalPrice).toLocaleString('en-IN')}</td>
          </tr>`).join('')}
        <tr class="total-row"><td colspan="3">Subtotal</td><td>₹${parseFloat(invoice.subtotal).toLocaleString('en-IN')}</td></tr>
        <tr class="total-row"><td colspan="3">GST (${invoice.gstPercent}%)</td><td>₹${parseFloat(invoice.gstAmount).toLocaleString('en-IN')}</td></tr>
        <tr class="total-row"><td colspan="3">Total Amount</td><td>₹${parseFloat(invoice.totalAmount).toLocaleString('en-IN')}</td></tr>
        <tr class="total-row"><td colspan="3">Amount Due</td><td>₹${parseFloat(invoice.dueAmount).toLocaleString('en-IN')}</td></tr>
      </tbody>
    </table>
    ${invoice.dueDate ? `<p>Payment due by <strong>${moment(invoice.dueDate).tz(IST).format('DD MMM YYYY')}</strong>.</p>` : ''}
    ${invoice.terms ? `<p><strong>Terms:</strong> ${invoice.terms}</p>` : ''}
    <p>For any queries, please contact us.</p>
  `;
  return sendEmail({
    to: invoice.clientEmail,
    subject: `Invoice #${invoice.invoiceNumber} from ${orgSettings?.branding?.companyName || 'Us'}`,
    html: baseTemplate(`Invoice #${invoice.invoiceNumber}`, content, orgSettings),
    attachments: pdfBuffer ? [{ filename: `${invoice.invoiceNumber}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }] : [],
    smtpConfig,
    orgSettings,
  });
};

module.exports = {
  sendEmail,
  sendLeadAcknowledgement,
  sendQuotationEmail,
  sendInvoiceEmail,
  sendInvoiceDueReminder,
  sendFollowupReminderEmail,
  sendAppointmentReminder,
  sendCustomEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  baseTemplate,
};
