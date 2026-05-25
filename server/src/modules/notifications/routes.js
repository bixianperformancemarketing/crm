const router = require('express').Router();
const { authenticate } = require('../../middleware/auth');
const ctrl = require('./controller');

router.use(authenticate);

router.get('/', ctrl.getNotifications);
router.get('/count', ctrl.getUnreadCount);
router.get('/recent', ctrl.getRecent);
router.put('/mark-all-read', ctrl.markAllRead);
router.put('/:id/read', ctrl.markRead);

module.exports = router;
