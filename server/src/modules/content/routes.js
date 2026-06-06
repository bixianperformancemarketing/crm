const router = require('express').Router();
const { authenticate, requireRole } = require('../../middleware/auth');
const { scopeTenant, requireWorkspace } = require('../../middleware/tenant');
const { checkFeature } = require('../../middleware/entitlement');
const ctrl = require('./controller');

router.use(authenticate, scopeTenant, requireWorkspace, checkFeature('canUseContentCalendar'));

router.get('/', ctrl.getTasks);
router.get('/calendar', ctrl.getCalendarTasks);
router.get('/:id', ctrl.getTask);
router.post('/', requireRole('admin', 'employee', 'owner'), ctrl.createTask);
router.put('/:id', ctrl.updateTask);
router.delete('/:id', requireRole('admin', 'owner'), ctrl.deleteTask);

module.exports = router;
