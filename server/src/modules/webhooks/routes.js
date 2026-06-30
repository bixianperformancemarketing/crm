const router = require('express').Router();
const ctrl = require('./controller');

// Webhook endpoints are public-facing receivers — any origin must be able to POST to them
const webhookCors = (req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
};

router.use(webhookCors);
router.options('*', webhookCors);

router.get('/:token/meta', ctrl.metaWebhookGet);
router.post('/:token/meta', ctrl.metaWebhookPost);
router.get('/:token/google', ctrl.googleWebhookGet);
router.post('/:token/google', ctrl.googleWebhookPost);
router.post('/:token/website', ctrl.websiteWebhookPost);
router.get('/:token/whatsapp', ctrl.whatsappWebhookGet);
router.post('/:token/whatsapp', ctrl.whatsappWebhookPost);
router.post('/:token/instagram', ctrl.instagramWebhookPost);

module.exports = router;
