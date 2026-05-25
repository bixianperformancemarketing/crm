const router = require('express').Router();
const { authenticate } = require('../../middleware/auth');
const { scopeTenant, requireWorkspace } = require('../../middleware/tenant');
const { checkFeature } = require('../../middleware/entitlement');
const ctrl = require('./controller');

router.use(authenticate, scopeTenant, requireWorkspace);

router.get('/', ctrl.getInvoices);
router.get('/:id', ctrl.getInvoice);
router.post('/', ctrl.createInvoice);
router.put('/:id', ctrl.updateInvoice);
router.get('/:id/pdf', checkFeature('canUsePDF'), ctrl.downloadPDF);

module.exports = router;
