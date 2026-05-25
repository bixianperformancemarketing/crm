const router = require('express').Router();
const { authenticate, requireRole } = require('../../middleware/auth');
const ctrl = require('./controller');

router.use(authenticate);

router.get('/dashboard', requireRole('owner'), ctrl.getOwnerDashboard);
router.get('/workspaces', requireRole('owner'), ctrl.getWorkspaces);
router.post('/workspaces', requireRole('owner'), ctrl.createWorkspace);
router.get('/workspaces/:id', requireRole('owner'), ctrl.getWorkspaceById);
router.put('/workspaces/:id', requireRole('owner'), ctrl.updateWorkspace);
router.delete('/workspaces/:id', requireRole('owner'), ctrl.deleteWorkspace);
router.get('/reports', requireRole('owner'), ctrl.getOrgReports);
router.get('/settings', requireRole('owner', 'admin'), ctrl.getOrgSettings);
router.put('/settings', requireRole('owner'), ctrl.updateOrgSettings);

router.get('/webhook-workspaces', requireRole('owner', 'admin'), ctrl.getWebhookWorkspaces);
router.get('/webhook-routes', requireRole('owner', 'admin'), ctrl.getWebhookRoutes);
router.post('/webhook-routes', requireRole('owner'), ctrl.createWebhookRoute);
router.put('/webhook-routes/:id', requireRole('owner'), ctrl.updateWebhookRoute);
router.delete('/webhook-routes/:id', requireRole('owner'), ctrl.deleteWebhookRoute);

module.exports = router;
