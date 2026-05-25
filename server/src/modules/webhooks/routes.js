const router = require('express').Router();
const ctrl = require('./controller');

router.get('/:token/meta', ctrl.metaWebhookGet);
router.post('/:token/meta', ctrl.metaWebhookPost);
router.get('/:token/google', ctrl.googleWebhookGet);
router.post('/:token/google', ctrl.googleWebhookPost);
router.post('/:token/website', ctrl.websiteWebhookPost);
router.get('/:token/whatsapp', ctrl.whatsappWebhookGet);
router.post('/:token/whatsapp', ctrl.whatsappWebhookPost);
router.post('/:token/instagram', ctrl.instagramWebhookPost);

module.exports = router;
