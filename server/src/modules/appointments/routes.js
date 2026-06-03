const router = require('express').Router();
const { authenticate } = require('../../middleware/auth');
const { scopeTenant, requireWorkspace } = require('../../middleware/tenant');
const { checkFeature } = require('../../middleware/entitlement');
const ctrl = require('./controller');

router.use(authenticate, scopeTenant, requireWorkspace, checkFeature('canUseAppointments'));

router.get('/', ctrl.getAppointments);
router.get('/calendar', ctrl.getCalendar);
router.get('/today', ctrl.getTodayAppointments);
router.get('/upcoming', ctrl.getUpcoming);
router.post('/', ctrl.createAppointment);
router.put('/:id', ctrl.updateAppointment);
router.put('/:id/status', ctrl.updateStatus);
router.delete('/:id', ctrl.deleteAppointment);

module.exports = router;
