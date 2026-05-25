const { Op } = require('sequelize');
const { Invoice, Payment, Lead, User, LeadActivity, Organization } = require('../../config/models');
const { getNextNumber, paginate, paginateResponse } = require('../../utils/helpers');
const { generateInvoicePDF } = require('../../services/pdfService');
const { logUsage } = require('../../middleware/entitlement');

const getInvoices = async (req, res) => {
  try {
    const { user, workspaceId } = req;
    const { page = 1, limit = 20, status, leadId } = req.query;
    const { limit: lim, offset } = paginate(page, limit);
    const where = { organizationId: user.organizationId, workspaceId };
    if (status) where.status = status;
    if (leadId) where.leadId = leadId;

    const { count, rows } = await Invoice.findAndCountAll({
      where,
      include: [
        { model: Lead, as: 'lead', attributes: ['id', 'name'], required: false },
        { model: User, as: 'creator', attributes: ['id', 'name'], required: false },
      ],
      order: [['createdAt', 'DESC']],
      limit: lim, offset,
    });
    res.json({ success: true, ...paginateResponse(rows, count, page, lim) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch invoices' });
  }
};

const getInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const { user, workspaceId } = req;
    const inv = await Invoice.findOne({
      where: { id, organizationId: user.organizationId, workspaceId },
      include: [
        { model: Payment, as: 'payments', include: [{ model: User, as: 'receiver', attributes: ['id', 'name'], required: false }] },
        { model: Lead, as: 'lead', attributes: ['id', 'name', 'phone', 'email'], required: false },
        { model: User, as: 'creator', attributes: ['id', 'name'], required: false },
      ],
    });
    if (!inv) return res.status(404).json({ success: false, message: 'Invoice not found' });
    res.json({ success: true, invoice: inv });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch invoice' });
  }
};

const createInvoice = async (req, res) => {
  try {
    const { user, workspaceId } = req;
    const { leadId, clientName, clientEmail, clientPhone, clientAddress, clientGST, subtotal, gstPercent = 18, notes, terms, dueDate } = req.body;
    if (!subtotal) return res.status(400).json({ success: false, message: 'Subtotal is required' });

    const gstAmount = (parseFloat(subtotal) * parseFloat(gstPercent)) / 100;
    const totalAmount = parseFloat(subtotal) + gstAmount;
    const invNumber = await getNextNumber(Invoice, 'invoiceNumber', 'INV-', workspaceId, user.organizationId);

    const inv = await Invoice.create({
      organizationId: user.organizationId, workspaceId, invoiceNumber: invNumber,
      leadId: leadId || null, createdBy: user.id,
      clientName, clientEmail, clientPhone, clientAddress, clientGST,
      subtotal: parseFloat(subtotal), gstPercent, gstAmount, totalAmount,
      paidAmount: 0, dueAmount: totalAmount, status: 'Unpaid', notes, terms,
      dueDate: dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    if (leadId) {
      await LeadActivity.create({
        leadId, organizationId: user.organizationId, workspaceId, userId: user.id,
        type: 'invoice_generated', description: `Invoice ${invNumber} created`,
        metadata: { invoiceId: inv.id },
      });
    }
    res.status(201).json({ success: true, message: 'Invoice created', invoice: inv });
  } catch (err) {
    console.error('createInvoice error:', err);
    res.status(500).json({ success: false, message: 'Failed to create invoice' });
  }
};

const updateInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const { user, workspaceId } = req;
    const inv = await Invoice.findOne({ where: { id, organizationId: user.organizationId, workspaceId } });
    if (!inv) return res.status(404).json({ success: false, message: 'Invoice not found' });
    const allowed = ['clientName', 'clientEmail', 'clientPhone', 'clientAddress', 'clientGST', 'notes', 'terms', 'dueDate'];
    const updates = {};
    for (const k of allowed) { if (req.body[k] !== undefined) updates[k] = req.body[k]; }
    await inv.update(updates);
    res.json({ success: true, message: 'Invoice updated', invoice: inv });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update invoice' });
  }
};

const downloadPDF = async (req, res) => {
  try {
    const { id } = req.params;
    const { user, workspaceId } = req;
    const inv = await Invoice.findOne({ where: { id, organizationId: user.organizationId, workspaceId } });
    if (!inv) return res.status(404).json({ success: false, message: 'Invoice not found' });
    const org = await Organization.findByPk(user.organizationId, { attributes: ['settings'] });
    const pdf = await generateInvoicePDF(inv, org?.settings);
    await logUsage(user.organizationId, workspaceId, 'pdf_generated');
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${inv.invoiceNumber}.pdf"` });
    res.send(pdf);
  } catch (err) {
    console.error('downloadInvoicePDF error:', err);
    res.status(500).json({ success: false, message: 'Failed to generate PDF' });
  }
};

module.exports = { getInvoices, getInvoice, createInvoice, updateInvoice, downloadPDF };
