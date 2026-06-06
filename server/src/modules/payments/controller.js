const { Op, fn, col } = require('sequelize');
const { Payment, Invoice, Lead, User, LeadActivity } = require('../../config/models');
const { paginate, paginateResponse } = require('../../utils/helpers');
const notificationService = require('../../services/notificationService');

const getPayments = async (req, res) => {
  try {
    const { user, workspaceId } = req;
    const { page = 1, limit = 20, mode, dateFrom, dateTo } = req.query;
    const { limit: lim, offset } = paginate(page, limit);
    const ws = workspaceId ? { workspaceId } : {};
    const where = { organizationId: user.organizationId, ...ws };
    if (mode) where.mode = mode;
    if (dateFrom || dateTo) {
      where.receivedAt = {};
      if (dateFrom) where.receivedAt[Op.gte] = new Date(dateFrom);
      if (dateTo) where.receivedAt[Op.lte] = new Date(dateTo);
    }

    const { count, rows } = await Payment.findAndCountAll({
      where,
      include: [
        { model: Invoice, as: 'invoice', attributes: ['id', 'invoiceNumber', 'clientName', 'totalAmount'], required: false },
        { model: User, as: 'receiver', attributes: ['id', 'name'], required: false },
      ],
      order: [['receivedAt', 'DESC']],
      limit: lim, offset,
    });
    res.json({ success: true, ...paginateResponse(rows, count, page, lim) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch payments' });
  }
};

const addPayment = async (req, res) => {
  try {
    const { user, workspaceId } = req;
    const { invoiceId, amount, mode, reference, note, receivedAt } = req.body;
    if (!invoiceId || !amount || !mode) {
      return res.status(400).json({ success: false, message: 'Invoice, amount, and mode are required' });
    }

    const ws = workspaceId ? { workspaceId } : {};
    const inv = await Invoice.findOne({ where: { id: invoiceId, organizationId: user.organizationId, ...ws } });
    if (!inv) return res.status(404).json({ success: false, message: 'Invoice not found' });
    if (inv.status === 'Paid') return res.status(400).json({ success: false, message: 'Invoice is already fully paid' });
    if (parseFloat(amount) > parseFloat(inv.dueAmount)) {
      return res.status(400).json({ success: false, message: `Amount exceeds balance due (₹${parseFloat(inv.dueAmount).toLocaleString('en-IN')})` });
    }

    const payment = await Payment.create({
      organizationId: user.organizationId, workspaceId: inv.workspaceId,
      invoiceId, leadId: inv.leadId, receivedBy: user.id,
      amount: parseFloat(amount), mode, reference: reference || null,
      note: note || null, receivedAt: receivedAt || new Date(),
    });

    const newPaidAmount = parseFloat(inv.paidAmount) + parseFloat(amount);
    const newDueAmount = parseFloat(inv.totalAmount) - newPaidAmount;
    let newStatus = 'Partial';
    if (newPaidAmount >= parseFloat(inv.totalAmount)) newStatus = 'Paid';
    if (newPaidAmount <= 0) newStatus = 'Unpaid';

    await inv.update({ paidAmount: newPaidAmount, dueAmount: Math.max(0, newDueAmount), status: newStatus });

    if (inv.leadId) {
      await LeadActivity.create({
        leadId: inv.leadId, organizationId: user.organizationId, workspaceId: inv.workspaceId,
        userId: user.id, type: 'payment_received',
        description: `Payment of ₹${parseFloat(amount).toLocaleString('en-IN')} received via ${mode}`,
        metadata: { paymentId: payment.id, invoiceId },
      });
    }

    const admins = await User.findAll({
      where: { workspaceId: inv.workspaceId, organizationId: user.organizationId, role: 'admin', isActive: true },
      attributes: ['id'],
    });
    await notificationService.notifyPaymentReceived({
      payment, invoice: inv, adminIds: admins.map((a) => a.id),
      organizationId: user.organizationId, workspaceId: inv.workspaceId,
    });

    res.status(201).json({ success: true, message: 'Payment recorded', payment, invoice: inv });
  } catch (err) {
    console.error('addPayment error:', err);
    res.status(500).json({ success: false, message: 'Failed to record payment' });
  }
};

const getPaymentStats = async (req, res) => {
  try {
    const { user, workspaceId } = req;
    const { months = 12 } = req.query;
    const since = new Date(); since.setMonth(since.getMonth() - parseInt(months));

    const ws = workspaceId ? { workspaceId } : {};
    const [monthly, byMode] = await Promise.all([
      Payment.findAll({
        where: { organizationId: user.organizationId, ...ws, receivedAt: { [Op.gte]: since } },
        attributes: [
          [fn('YEAR', col('receivedAt')), 'year'],
          [fn('MONTH', col('receivedAt')), 'month'],
          [fn('SUM', col('amount')), 'total'],
        ],
        group: [fn('YEAR', col('receivedAt')), fn('MONTH', col('receivedAt'))],
        order: [[fn('YEAR', col('receivedAt')), 'ASC'], [fn('MONTH', col('receivedAt')), 'ASC']],
        raw: true,
      }),
      Payment.findAll({
        where: { organizationId: user.organizationId, ...ws },
        attributes: ['mode', [fn('SUM', col('amount')), 'total']],
        group: ['mode'],
        raw: true,
      }),
    ]);

    res.json({ success: true, monthly, byMode });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch payment stats' });
  }
};

module.exports = { getPayments, addPayment, getPaymentStats };
