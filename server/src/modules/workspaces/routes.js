const router = require('express').Router();
const { authenticate, requireRole } = require('../../middleware/auth');
const ctrl = require('./controller');

router.use(authenticate);
router.get('/', ctrl.getWorkspace);
router.put('/', requireRole('admin'), ctrl.updateWorkspaceSettings);

module.exports = router;
