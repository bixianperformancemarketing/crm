const router = require('express').Router();
const { authenticate } = require('../../middleware/auth');
const { requireSuperAdmin } = require('../../middleware/superadmin');
const ctrl = require('./controller');

router.use(authenticate, requireSuperAdmin);

router.get('/dashboard', ctrl.getDashboard);
router.get('/organizations', ctrl.getOrganizations);
router.post('/organizations', ctrl.createOrganization);
router.get('/organizations/:id', ctrl.getOrganization);
router.put('/organizations/:id', ctrl.updateOrganization);
router.post('/organizations/:id/suspend', ctrl.suspendOrganization);
router.post('/organizations/:id/unsuspend', ctrl.unsuspendOrganization);
router.delete('/organizations/:id', ctrl.deleteOrganization);
router.get('/plans', ctrl.getPlans);
router.put('/plans/:id', ctrl.updatePlan);

module.exports = router;
