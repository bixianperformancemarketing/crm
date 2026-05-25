const { EmployeeLabel } = require('../../config/models');

const DEFAULT_LABELS = [
  { name: 'Agent', color: '#0ea5e9' },
  { name: 'Marketer', color: '#f59e0b' },
  { name: 'Designer', color: '#22c55e' },
  { name: 'Developer', color: '#8b5cf6' },
  { name: 'Sales', color: '#e94560' },
  { name: 'Support', color: '#06b6d4' },
];

const getLabels = async (req, res) => {
  try {
    const labels = await EmployeeLabel.findAll({
      where: { organizationId: req.user.organizationId },
      order: [['isDefault', 'DESC'], ['name', 'ASC']],
    });
    if (labels.length === 0) {
      const created = await EmployeeLabel.bulkCreate(
        DEFAULT_LABELS.map(l => ({ ...l, organizationId: req.user.organizationId, isDefault: true })),
        { returning: true }
      );
      return res.json({ success: true, labels: created });
    }
    res.json({ success: true, labels });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch labels' });
  }
};

const createLabel = async (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: 'Label name required' });
    const existing = await EmployeeLabel.findOne({ where: { organizationId: req.user.organizationId, name: name.trim() } });
    if (existing) return res.status(400).json({ success: false, message: 'Label already exists' });
    const label = await EmployeeLabel.create({
      organizationId: req.user.organizationId,
      name: name.trim(),
      color: color || '#6b7280',
      isDefault: false,
    });
    res.status(201).json({ success: true, label });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create label' });
  }
};

const deleteLabel = async (req, res) => {
  try {
    const label = await EmployeeLabel.findOne({ where: { id: req.params.id, organizationId: req.user.organizationId } });
    if (!label) return res.status(404).json({ success: false, message: 'Label not found' });
    if (label.isDefault) return res.status(400).json({ success: false, message: 'Cannot delete default labels' });
    await label.destroy();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete label' });
  }
};

module.exports = { getLabels, createLabel, deleteLabel };
