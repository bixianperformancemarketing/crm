const router = require('express').Router();
const { authenticate, requireRole } = require('../../middleware/auth');
const { scopeTenant, requireWorkspace } = require('../../middleware/tenant');
const { checkUserLimit } = require('../../middleware/entitlement');
const ctrl = require('./controller');

router.use(authenticate, scopeTenant);

router.get('/', requireWorkspace, ctrl.getUsers);
router.get('/:id', ctrl.getUser);
router.post('/', requireRole('admin', 'owner'), requireWorkspace, checkUserLimit, ctrl.createUser);
router.put('/:id', requireRole('admin', 'owner'), ctrl.updateUser);
router.delete('/:id', requireRole('admin', 'owner'), ctrl.deleteUser);

module.exports = router;
