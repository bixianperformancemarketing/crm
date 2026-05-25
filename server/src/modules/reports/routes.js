const router = require('express').Router();
const { authenticate, requireRole } = require('../../middleware/auth');
const { scopeTenant, requireWorkspace } = require('../../middleware/tenant');
const { checkFeature } = require('../../middleware/entitlement');
const ctrl = require('./controller');

router.use(authenticate, scopeTenant, requireWorkspace);

router.get('/dashboard', ctrl.getDashboard);
router.get('/advanced', checkFeature('canUseAdvancedReports'), requireRole('admin', 'owner'), ctrl.getAdvancedReports);

module.exports = router;
