const router = require('express').Router();
const { authenticate, requireRole } = require('../../middleware/auth');
const { scopeTenant, requireWorkspace } = require('../../middleware/tenant');
const { checkFeature } = require('../../middleware/entitlement');
const ctrl = require('./controller');

router.use(authenticate, scopeTenant, requireWorkspace);

router.get('/', ctrl.getQuotations);
router.get('/:id', ctrl.getQuotation);
router.post('/', ctrl.createQuotation);
router.put('/:id', ctrl.updateQuotation);
router.put('/:id/status', ctrl.updateStatus);
router.get('/:id/pdf', checkFeature('canUsePDF'), ctrl.downloadPDF);
router.post('/:id/send-email', checkFeature('canUsePDF'), ctrl.sendEmail);

module.exports = router;
