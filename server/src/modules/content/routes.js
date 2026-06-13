const router = require('express').Router();
const { authenticate, requireRole } = require('../../middleware/auth');
const { scopeTenant, requireWorkspace } = require('../../middleware/tenant');
const { checkFeature } = require('../../middleware/entitlement');
const ctrl = require('./controller');

router.use(authenticate, scopeTenant, requireWorkspace, checkFeature('canUseContentCalendar'));

router.get('/', ctrl.getTasks);
router.get('/calendar', ctrl.getCalendarTasks);
router.get('/pipeline', ctrl.getTaskPipeline);
router.get('/archived', ctrl.getArchivedTasks);
router.post('/archive-bulk', requireRole('admin', 'owner', 'employee'), ctrl.archiveBulk);
router.get('/:id', ctrl.getTask);
router.post('/', requireRole('admin', 'employee', 'owner'), ctrl.createTask);
router.put('/:id', ctrl.updateTask);
router.delete('/:id', requireRole('admin', 'owner'), ctrl.deleteTask);
router.post('/:id/archive', requireRole('admin', 'owner'), ctrl.archiveTask);
router.post('/:id/unarchive', requireRole('admin', 'owner'), ctrl.unarchiveTask);

module.exports = router;
