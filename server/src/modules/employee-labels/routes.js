const router = require('express').Router();
const { authenticate, requireRole } = require('../../middleware/auth');
const ctrl = require('./controller');

router.use(authenticate);
router.get('/', ctrl.getLabels);
router.post('/', requireRole('admin', 'owner'), ctrl.createLabel);
router.delete('/:id', requireRole('admin', 'owner'), ctrl.deleteLabel);

module.exports = router;
