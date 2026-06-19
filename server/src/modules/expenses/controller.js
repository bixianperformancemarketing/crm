const { Op } = require('sequelize');
const { Expense, User, Workspace } = require('../../config/models');
const notificationService = require('../../services/notificationService');

const PAYMENT_MODES = ['UPI', 'Bank Transfer', 'Cash', 'Cheque', 'Online'];

const getExpenses = async (req, res) => {
  try {
    const { user } = req;
    const { status, category, from, to, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const where = { organizationId: user.organizationId };
    if (user.role === 'employee') where.submittedBy = user.id;
    if (status) where.status = status;
    if (category) where.category = category;
    if (from && to) where.expenseDate = { [Op.between]: [from, to] };

    const { count, rows } = await Expense.findAndCountAll({
      where,
      include: [
        { model: User, as: 'submitter', attributes: ['id', 'name', 'role'] },
        { model: User, as: 'approver', attributes: ['id', 'name'] },
        { model: Workspace, as: 'workspace', attributes: ['id', 'name'], required: false },
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset,
    });

    res.json({ success: true, expenses: rows, total: count, page: parseInt(page), pages: Math.ceil(count / parseInt(limit)) });
  } catch (err) {
    console.error('getExpenses error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch expenses' });
  }
};

const createExpense = async (req, res) => {
  try {
    const { user } = req;
    const { title, category, amount, expenseDate, billReference, paymentMode, notes, workspaceId } = req.body;

    if (!title || !amount || !expenseDate || !paymentMode) {
      return res.status(400).json({ success: false, message: 'Title, amount, date, and payment mode are required' });
    }
    if (!PAYMENT_MODES.includes(paymentMode)) {
      return res.status(400).json({ success: false, message: 'Invalid payment mode' });
    }

    const expense = await Expense.create({
      organizationId: user.organizationId,
      workspaceId: workspaceId ? parseInt(workspaceId) : null,
      submittedBy: user.id,
      title: title.trim(),
      category: category?.trim() || null,
      amount: parseFloat(amount),
      expenseDate,
      billReference: billReference?.trim() || null,
      paymentMode,
      notes: notes?.trim() || null,
      status: 'Pending',
    });

    await notificationService.notifyExpenseSubmitted({ expense, submitter: user });

    res.status(201).json({ success: true, expense });
  } catch (err) {
    console.error('createExpense error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to create expense' });
  }
};

const updateExpense = async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;

    const expense = await Expense.findOne({ where: { id, organizationId: user.organizationId } });
    if (!expense) return res.status(404).json({ success: false, message: 'Expense not found' });

    if (user.role === 'employee' && expense.submittedBy !== user.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    if (expense.status !== 'Pending') {
      return res.status(400).json({ success: false, message: 'Only pending expenses can be edited' });
    }

    const { title, category, amount, expenseDate, billReference, paymentMode, notes, workspaceId } = req.body;
    const updates = {};
    if (title) updates.title = title.trim();
    if (category) updates.category = category;
    if (amount !== undefined) updates.amount = parseFloat(amount);
    if (expenseDate) updates.expenseDate = expenseDate;
    if (billReference !== undefined) updates.billReference = billReference?.trim() || null;
    if (paymentMode) updates.paymentMode = paymentMode;
    if (notes !== undefined) updates.notes = notes?.trim() || null;
    if (workspaceId !== undefined) updates.workspaceId = workspaceId ? parseInt(workspaceId) : null;

    await expense.update(updates);
    res.json({ success: true, expense });
  } catch (err) {
    console.error('updateExpense error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to update expense' });
  }
};

const approveExpense = async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;

    const expense = await Expense.findOne({
      where: { id, organizationId: user.organizationId },
      include: [{ model: User, as: 'submitter', attributes: ['id', 'name'] }],
    });
    if (!expense) return res.status(404).json({ success: false, message: 'Expense not found' });
    if (expense.status !== 'Pending') {
      return res.status(400).json({ success: false, message: 'Only pending expenses can be approved' });
    }

    await expense.update({ status: 'Approved', approvedBy: user.id });
    await notificationService.notifyExpenseApproved({ expense, approver: user });

    res.json({ success: true, expense });
  } catch (err) {
    console.error('approveExpense error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to approve expense' });
  }
};

const rejectExpense = async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;
    const { reason } = req.body;

    const expense = await Expense.findOne({
      where: { id, organizationId: user.organizationId },
      include: [{ model: User, as: 'submitter', attributes: ['id', 'name'] }],
    });
    if (!expense) return res.status(404).json({ success: false, message: 'Expense not found' });
    if (expense.status !== 'Pending') {
      return res.status(400).json({ success: false, message: 'Only pending expenses can be rejected' });
    }

    await expense.update({ status: 'Rejected', rejectionReason: reason?.trim() || null, approvedBy: user.id });
    await notificationService.notifyExpenseRejected({ expense, approver: user, reason });

    res.json({ success: true, expense });
  } catch (err) {
    console.error('rejectExpense error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to reject expense' });
  }
};

const deleteExpense = async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;

    const expense = await Expense.findOne({ where: { id, organizationId: user.organizationId } });
    if (!expense) return res.status(404).json({ success: false, message: 'Expense not found' });

    if (user.role === 'employee' && expense.submittedBy !== user.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    if (user.role === 'employee' && expense.status !== 'Pending') {
      return res.status(400).json({ success: false, message: 'Only pending expenses can be deleted' });
    }

    await expense.destroy();
    res.json({ success: true, message: 'Expense deleted' });
  } catch (err) {
    console.error('deleteExpense error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to delete expense' });
  }
};

const getExpenseSummary = async (req, res) => {
  try {
    const { user } = req;
    const { from, to } = req.query;
    const where = { organizationId: user.organizationId, status: 'Approved' };
    if (from && to) where.expenseDate = { [Op.between]: [from, to] };

    const expenses = await Expense.findAll({ where, attributes: ['category', 'amount'], raw: true });

    const byCategory = {};
    let total = 0;
    for (const e of expenses) {
      byCategory[e.category] = (byCategory[e.category] || 0) + parseFloat(e.amount);
      total += parseFloat(e.amount);
    }

    res.json({ success: true, total, byCategory });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch summary' });
  }
};

module.exports = { getExpenses, createExpense, updateExpense, approveExpense, rejectExpense, deleteExpense, getExpenseSummary };
