const { Workspace, Organization } = require('../../config/models');

const getWorkspace = async (req, res) => {
  try {
    const wsId = req.user.workspaceId;
    const ws = await Workspace.findOne({
      where: { id: wsId, organizationId: req.user.organizationId },
      include: [{ model: Organization, as: 'organization', attributes: ['id', 'name', 'settings', 'plan', 'canUsePDF', 'canUseWebhooks', 'canUseCSVImport', 'canUseContentCalendar', 'canUseAdvancedReports', 'webhookToken', 'maxUsersPerWorkspace'] }],
    });
    if (!ws) return res.status(404).json({ success: false, message: 'Workspace not found' });
    res.json({ success: true, workspace: ws });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch workspace' });
  }
};

const updateWorkspaceSettings = async (req, res) => {
  try {
    const wsId = req.user.workspaceId;
    const ws = await Workspace.findOne({ where: { id: wsId, organizationId: req.user.organizationId } });
    if (!ws) return res.status(404).json({ success: false, message: 'Workspace not found' });
    const { name, description, settings } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (settings) updates.settings = { ...ws.settings, ...settings };
    await ws.update(updates);
    res.json({ success: true, message: 'Workspace updated', workspace: ws });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update workspace' });
  }
};

module.exports = { getWorkspace, updateWorkspaceSettings };
