const router = require('express').Router();
const multer = require('multer');
const { authenticate, requireRole } = require('../../middleware/auth');
const { scopeTenant, requireWorkspace } = require('../../middleware/tenant');
const { checkLeadLimit, checkFeature } = require('../../middleware/entitlement');
const ctrl = require('./controller');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760 } });

router.use(authenticate, scopeTenant, requireWorkspace);

router.get('/', ctrl.getLeads);
router.get('/pipeline', ctrl.getPipeline);
router.get('/:id', ctrl.getLead);
router.post('/', checkLeadLimit, ctrl.createLead);
router.put('/bulk-assign', requireRole('admin'), ctrl.bulkAssign);
router.put('/:id', ctrl.updateLead);
router.delete('/:id', requireRole('admin'), ctrl.deleteLead);
router.post('/:id/note', ctrl.addNote);
router.post('/import/csv', checkFeature('canUseCSVImport'), checkLeadLimit, upload.single('file'), ctrl.importCSV);

module.exports = router;
