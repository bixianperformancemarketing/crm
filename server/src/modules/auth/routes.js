const router = require('express').Router();
const { authenticate } = require('../../middleware/auth');
const ctrl = require('./controller');

router.post('/login', ctrl.login);
router.post('/forgot-password', ctrl.forgotPassword);
router.post('/reset-password', ctrl.resetPassword);
router.get('/me', authenticate, ctrl.getMe);
router.put('/change-password', authenticate, ctrl.changePassword);
router.put('/profile', authenticate, ctrl.updateProfile);

module.exports = router;
