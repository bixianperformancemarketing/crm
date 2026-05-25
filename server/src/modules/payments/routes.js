const router = require('express').Router();
const { authenticate } = require('../../middleware/auth');
const { scopeTenant, requireWorkspace } = require('../../middleware/tenant');
const ctrl = require('./controller');

router.use(authenticate, scopeTenant, requireWorkspace);

router.get('/', ctrl.getPayments);
router.get('/stats', ctrl.getPaymentStats);
router.post('/', ctrl.addPayment);

module.exports = router;
