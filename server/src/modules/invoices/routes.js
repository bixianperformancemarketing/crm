const router = require('express').Router();
const { authenticate } = require('../../middleware/auth');
const { scopeTenant, requireWorkspace } = require('../../middleware/tenant');
const { checkFeature } = require('../../middleware/entitlement');
const ctrl = require('./controller');

router.use(authenticate, scopeTenant, requireWorkspace, checkFeature('canUseInvoices'));

router.get('/', ctrl.getInvoices);
router.get('/pending-by-client', ctrl.getPendingByClient);
router.get('/:id', ctrl.getInvoice);
router.post('/', ctrl.createInvoice);
router.put('/:id', ctrl.updateInvoice);
router.get('/:id/pdf', checkFeature('canUsePDF'), ctrl.downloadPDF);
router.post('/:id/send-email', checkFeature('canUsePDF'), ctrl.sendEmail);
router.post('/:id/whatsapp-share', checkFeature('canUsePDF'), ctrl.whatsappShare);
router.delete('/:id', ctrl.deleteInvoice);

module.exports = router;
