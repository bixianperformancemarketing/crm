const router = require('express').Router();
const { authenticate, requireRole } = require('../../middleware/auth');
const { scopeTenant } = require('../../middleware/tenant');
const ctrl = require('./controller');

router.use(authenticate, scopeTenant);

router.get('/', ctrl.getExpenses);
router.get('/summary', ctrl.getExpenseSummary);
router.post('/', ctrl.createExpense);
router.put('/:id', ctrl.updateExpense);
router.post('/:id/approve', requireRole('admin', 'owner'), ctrl.approveExpense);
router.post('/:id/reject', requireRole('admin', 'owner'), ctrl.rejectExpense);
router.delete('/:id', ctrl.deleteExpense);

module.exports = router;
