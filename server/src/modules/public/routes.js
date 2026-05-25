const express = require('express');
const router = express.Router();
const { Plan } = require('../../config/models');
const emailService = require('../../services/emailService');

router.get('/plans', async (req, res) => {
  try {
    const plans = await Plan.findAll({
      attributes: [
        'id', 'name', 'displayName', 'price', 'maxWorkspaces',
        'maxUsersPerWorkspace', 'maxLeadsTotal', 'canUseWebhooks',
        'canUsePDF', 'canUseCSVImport', 'canUseContentCalendar',
        'canUseAdvancedReports', 'description', 'durationDays',
      ],
      order: [['price', 'ASC']],
    });
    res.json({ success: true, plans });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch plans' });
  }
});

router.post('/test-email', async (req, res) => {
  const { to } = req.body;
  if (!to) return res.status(400).json({ success: false, message: 'Email address required' });
  const result = await emailService.sendEmail({
    to,
    subject: 'CRM Email Test',
    html: '<h2>Email is working!</h2><p>Your CRM SMTP setup is configured correctly.</p>',
  });
  if (result.success) return res.json({ success: true, message: 'Test email sent successfully' });
  res.status(500).json({ success: false, message: result.error });
});

module.exports = router;
