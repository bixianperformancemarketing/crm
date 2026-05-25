const router = require('express').Router();
const { authenticate } = require('../../middleware/auth');
const { scopeTenant, requireWorkspace } = require('../../middleware/tenant');
const ctrl = require('./controller');

router.use(authenticate, scopeTenant, requireWorkspace);

router.post('/calls', ctrl.logCall);
router.get('/calls', ctrl.getCallLogs);
router.post('/whatsapp', ctrl.logWhatsApp);
router.post('/email', ctrl.sendEmail);

module.exports = router;
