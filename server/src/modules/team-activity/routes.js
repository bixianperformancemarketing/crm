const router = require('express').Router();
const { authenticate, requireRole } = require('../../middleware/auth');
const { scopeTenant, requireWorkspace } = require('../../middleware/tenant');
const ctrl = require('./controller');

router.use(authenticate, scopeTenant, requireWorkspace, requireRole('admin', 'owner'));

router.get('/summary', ctrl.getTeamSummary);
router.get('/feed', ctrl.getTeamFeed);

module.exports = router;
