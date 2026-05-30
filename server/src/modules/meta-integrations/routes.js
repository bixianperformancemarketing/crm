const router = require('express').Router();
const { authenticate, requireRole } = require('../../middleware/auth');
const ctrl = require('./controller');

router.use(authenticate);
router.get('/', ctrl.list);
router.post('/', requireRole('owner'), ctrl.connect);
router.put('/:id', requireRole('owner'), ctrl.update);
router.delete('/:id', requireRole('owner'), ctrl.disconnect);
router.post('/:id/sync', requireRole('owner', 'admin'), ctrl.manualSync);
router.get('/:id/forms', requireRole('owner', 'admin'), ctrl.getForms);
router.put('/:id/form-routes', requireRole('owner'), ctrl.updateFormRoutes);
router.get('/:id/test', requireRole('owner', 'admin'), ctrl.testConnection);
router.post('/backfill-names', requireRole('owner', 'admin'), ctrl.backfillNames);

module.exports = router;
