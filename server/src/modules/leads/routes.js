const router = require('express').Router();
const multer = require('multer');
const { authenticate, requireRole } = require('../../middleware/auth');
const { scopeTenant, requireWorkspace } = require('../../middleware/tenant');
const { checkLeadLimit, checkFeature } = require('../../middleware/entitlement');
const ctrl = require('./controller');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760 } });

const checkLeadAccess = (req, res, next) => {
  if (req.user?.role === 'employee' && req.user?.canAccessLeads === false) {
    return res.status(403).json({ success: false, message: 'You do not have access to leads.' });
  }
  next();
};

router.use(authenticate, scopeTenant, requireWorkspace, checkLeadAccess);

router.get('/', ctrl.getLeads);
router.get('/pipeline', ctrl.getPipeline);
router.get('/:id', ctrl.getLead);
router.post('/', checkLeadLimit, ctrl.createLead);
router.put('/bulk-assign', requireRole('admin', 'owner'), ctrl.bulkAssign);
router.delete('/bulk-delete', requireRole('admin', 'owner'), ctrl.bulkDelete);
router.put('/:id', ctrl.updateLead);
router.delete('/:id', requireRole('admin', 'owner'), ctrl.deleteLead);
router.post('/:id/note', ctrl.addNote);
router.post('/import/csv', checkFeature('canUseCSVImport'), checkLeadLimit, upload.single('file'), ctrl.importCSV);

module.exports = router;
