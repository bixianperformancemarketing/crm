const router = require('express').Router();
const { authenticate } = require('../../middleware/auth');
const { scopeTenant, requireWorkspace } = require('../../middleware/tenant');
const ctrl = require('./controller');

router.use(authenticate, scopeTenant, requireWorkspace);

router.get('/', ctrl.getFollowups);
router.get('/overdue-count', ctrl.getOverdueCount);
router.post('/', ctrl.createFollowup);
router.put('/:id', ctrl.updateFollowup);
router.post('/:id/complete', ctrl.completeFollowup);
router.post('/:id/cancel', ctrl.cancelFollowup);

module.exports = router;
