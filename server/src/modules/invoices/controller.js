const { Op } = require('sequelize');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { Invoice, InvoiceItem, Payment, Lead, User, LeadActivity, Organization } = require('../../config/models');
const { getNextNumber, paginate, paginateResponse } = require('../../utils/helpers');
const { generateInvoicePDF } = require('../../services/pdfService');
const emailService = require('../../services/emailService');
const { logUsage } = require('../../middleware/entitlement');

const getInvoices = async (req, res) => {
  try {
    const { user, workspaceId } = req;
    const { page = 1, limit = 20, status, leadId } = req.query;
    const { limit: lim, offset } = paginate(page, limit);
    const ws = workspaceId ? { workspaceId } : {};
    const where = { organizationId: user.organizationId, ...ws };
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
    const ws = workspaceId ? { workspaceId } : {};
    const inv = await Invoice.findOne({
      where: { id, organizationId: user.organizationId, ...ws },
      include: [
        { model: InvoiceItem, as: 'items', required: false },
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

const getPendingByClient = async (req, res) => {
  try {
    const { user, workspaceId } = req;
    const { phone, email } = req.query;
    if (!phone?.trim() && !email?.trim()) return res.json({ success: true, invoices: [] });

    const orClauses = [];
    if (phone?.trim()) orClauses.push({ phone: phone.trim() });
    if (email?.trim()) orClauses.push({ email: email.trim() });

    const ws = workspaceId ? { workspaceId } : {};
    const lead = await Lead.findOne({ where: { organizationId: user.organizationId, ...ws, [Op.or]: orClauses } });
    if (!lead) return res.json({ success: true, invoices: [] });

    const invoices = await Invoice.findAll({
      where: { organizationId: user.organizationId, ...ws, leadId: lead.id, status: { [Op.in]: ['Unpaid', 'Partial', 'Overdue'] } },
      attributes: ['id', 'invoiceNumber', 'totalAmount', 'paidAmount', 'dueAmount', 'status', 'createdAt'],
      order: [['createdAt', 'ASC']],
    });
    res.json({ success: true, invoices });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch pending invoices' });
  }
};

const createInvoice = async (req, res) => {
  try {
    const { user, workspaceId } = req;
    if (!workspaceId) return res.status(400).json({ success: false, message: 'Workspace context required for this action' });
    const { leadId, clientName, clientEmail, clientPhone, clientAddress, clientGST, items = [], gstPercent = 18, notes, terms, dueDate, includePendingCarryover = false, carryoverInvoices: carryoverData = [] } = req.body;

    if (!clientName?.trim()) return res.status(400).json({ success: false, message: 'Client name is required' });
    if (!clientPhone?.trim()) return res.status(400).json({ success: false, message: 'Phone number is required' });
    if (!items.length) return res.status(400).json({ success: false, message: 'At least one item is required' });

    // Find or create lead
    let lead = null;
    if (leadId) {
      lead = await Lead.findOne({ where: { id: leadId, organizationId: user.organizationId } });
    } else {
      const orClauses = [{ phone: clientPhone.trim() }];
      if (clientEmail?.trim()) orClauses.push({ email: clientEmail.trim() });
      const existing = await Lead.findOne({
        where: { organizationId: user.organizationId, workspaceId, [Op.or]: orClauses },
      });
      if (existing) {
        lead = existing;
      } else {
        lead = await Lead.create({
          organizationId: user.organizationId, workspaceId,
          name: clientName.trim(), phone: clientPhone.trim(),
          email: clientEmail?.trim() || null, address: clientAddress?.trim() || null,
          source: 'Invoice', status: 'Won', createdBy: user.id,
          assignedTo: user.role === 'employee' ? user.id : null,
        });
      }
    }

    const subtotal = items.reduce((sum, i) => sum + parseFloat(i.totalPrice || 0), 0);
    const gstAmount = (subtotal * parseFloat(gstPercent)) / 100;
    const totalAmount = subtotal + gstAmount;
    const carryoverTotal = includePendingCarryover
      ? carryoverData.reduce((sum, c) => sum + parseFloat(c.dueAmount || 0), 0)
      : 0;
    const invNumber = await getNextNumber(Invoice, 'invoiceNumber', 'INV-', workspaceId, user.organizationId);

    const inv = await Invoice.create({
      organizationId: user.organizationId, workspaceId, invoiceNumber: invNumber,
      leadId: lead?.id || null, createdBy: user.id,
      clientName: clientName.trim(), clientEmail: clientEmail?.trim() || null,
      clientPhone: clientPhone.trim(), clientAddress: clientAddress?.trim() || null, clientGST,
      subtotal, gstPercent, gstAmount, totalAmount,
      carryoverInvoices: includePendingCarryover ? carryoverData : [],
      carryoverTotal: includePendingCarryover ? carryoverTotal : 0,
      paidAmount: 0, dueAmount: totalAmount, status: 'Unpaid', notes, terms,
      dueDate: dueDate || null,
    });

    const itemsData = items.map((i) => ({
      invoiceId: inv.id,
      description: i.description,
      subDescription: i.subDescription || null,
      subItems: i.subItems || [],
      quantity: 1,
      unitPrice: 0,
      totalPrice: parseFloat(i.totalPrice) || 0,
    }));
    await InvoiceItem.bulkCreate(itemsData);

    if (lead?.id) {
      await LeadActivity.create({
        leadId: lead.id, organizationId: user.organizationId, workspaceId, userId: user.id,
        type: 'invoice_generated', description: `Invoice ${invNumber} created (₹${totalAmount.toLocaleString('en-IN')}${carryoverTotal > 0 ? ` + ₹${carryoverTotal.toLocaleString('en-IN')} previous balance` : ''})`,
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
    const ws = workspaceId ? { workspaceId } : {};
    const inv = await Invoice.findOne({ where: { id, organizationId: user.organizationId, ...ws } });
    if (!inv) return res.status(404).json({ success: false, message: 'Invoice not found' });

    const hasPayments = parseFloat(inv.paidAmount) > 0;
    const updates = {};

    if (hasPayments) {
      // Payment recorded — only allow non-financial fields
      if (req.body.terms !== undefined) updates.terms = req.body.terms;
      if (req.body.notes !== undefined) updates.notes = req.body.notes;
      if (req.body.dueDate !== undefined) updates.dueDate = req.body.dueDate;
    } else {
      // No payments — allow full edit including items and amounts
      const { items, gstPercent, clientName, clientEmail, clientPhone, clientAddress, clientGST, notes, terms, dueDate } = req.body;
      if (clientName !== undefined) updates.clientName = clientName;
      if (clientEmail !== undefined) updates.clientEmail = clientEmail;
      if (clientPhone !== undefined) updates.clientPhone = clientPhone;
      if (clientAddress !== undefined) updates.clientAddress = clientAddress;
      if (clientGST !== undefined) updates.clientGST = clientGST;
      if (notes !== undefined) updates.notes = notes;
      if (terms !== undefined) updates.terms = terms;
      if (dueDate !== undefined) updates.dueDate = dueDate;

      if (items && items.length) {
        const subtotal = items.reduce((sum, i) => sum + parseFloat(i.totalPrice || 0), 0);
        const gst = parseFloat(gstPercent || inv.gstPercent);
        const gstAmount = (subtotal * gst) / 100;
        const totalAmount = subtotal + gstAmount;
        updates.subtotal = subtotal;
        updates.gstPercent = gst;
        updates.gstAmount = gstAmount;
        updates.totalAmount = totalAmount;
        updates.dueAmount = totalAmount;

        await InvoiceItem.destroy({ where: { invoiceId: id } });
        await InvoiceItem.bulkCreate(items.map((i) => ({
          invoiceId: id,
          description: i.description,
          subDescription: i.subDescription || null,
          subItems: i.subItems || [],
          quantity: 1,
          unitPrice: 0,
          totalPrice: parseFloat(i.totalPrice) || 0,
        })));
      }
    }

    await inv.update(updates);
    res.json({ success: true, message: 'Invoice updated', invoice: inv });
  } catch (err) {
    console.error('updateInvoice error:', err);
    res.status(500).json({ success: false, message: 'Failed to update invoice' });
  }
};

const downloadPDF = async (req, res) => {
  try {
    const { id } = req.params;
    const { user, workspaceId } = req;
    const ws = workspaceId ? { workspaceId } : {};
    const inv = await Invoice.findOne({
      where: { id, organizationId: user.organizationId, ...ws },
      include: [{ model: InvoiceItem, as: 'items', required: false }],
    });
    if (!inv) return res.status(404).json({ success: false, message: 'Invoice not found' });
    const org = await Organization.findByPk(user.organizationId, { attributes: ['settings'] });
    const pdf = await generateInvoicePDF(inv, org?.settings, inv.items);
    await logUsage(user.organizationId, inv.workspaceId, 'pdf_generated');
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${inv.invoiceNumber}.pdf"` });
    res.send(pdf);
  } catch (err) {
    console.error('downloadInvoicePDF error:', err);
    res.status(500).json({ success: false, message: 'Failed to generate PDF' });
  }
};

const sendEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const { user, workspaceId } = req;
    const ws = workspaceId ? { workspaceId } : {};
    const inv = await Invoice.findOne({
      where: { id, organizationId: user.organizationId, ...ws },
      include: [{ model: InvoiceItem, as: 'items', required: false }],
    });
    if (!inv) return res.status(404).json({ success: false, message: 'Invoice not found' });
    if (!inv.clientEmail) return res.status(400).json({ success: false, message: 'Client email not set on this invoice' });

    const org = await Organization.findByPk(user.organizationId, { attributes: ['settings'] });
    const smtp = org?.settings?.smtp;
    if (!smtp?.host || !smtp?.user || !smtp?.pass) {
      return res.status(400).json({ success: false, smtpRequired: true, message: 'SMTP not configured. Go to Settings → Email (SMTP) to set up your email before sending.' });
    }
    const pdf = await generateInvoicePDF(inv, org?.settings, inv.items);
    const result = await emailService.sendInvoiceEmail(inv, inv.items || [], pdf, org?.settings, smtp);

    if (result.success) {
      res.json({ success: true, message: 'Invoice email sent' });
    } else {
      res.status(500).json({ success: false, message: 'Failed to send email', error: result.error });
    }
  } catch (err) {
    console.error('sendInvoiceEmail error:', err);
    res.status(500).json({ success: false, message: 'Failed to send invoice email' });
  }
};

const whatsappShare = async (req, res) => {
  try {
    const { id } = req.params;
    const { user, workspaceId } = req;
    const ws = workspaceId ? { workspaceId } : {};
    const inv = await Invoice.findOne({
      where: { id, organizationId: user.organizationId, ...ws },
      include: [{ model: InvoiceItem, as: 'items', required: false }],
    });
    if (!inv) return res.status(404).json({ success: false, message: 'Invoice not found' });

    const org = await Organization.findByPk(user.organizationId, { attributes: ['settings'] });
    const pdf = await generateInvoicePDF(inv, org?.settings, inv.items);

    const sharedDir = path.join(__dirname, '..', '..', '..', 'uploads', 'shared');
    fs.mkdirSync(sharedDir, { recursive: true });

    const fileName = `${uuidv4()}.pdf`;
    fs.writeFileSync(path.join(sharedDir, fileName), pdf);

    res.json({ success: true, fileName, phone: inv.clientPhone, clientName: inv.clientName, number: inv.invoiceNumber, totalAmount: inv.totalAmount, dueAmount: inv.dueAmount });
  } catch (err) {
    console.error('whatsappShare invoice error:', err);
    res.status(500).json({ success: false, message: 'Failed to generate share link' });
  }
};

const deleteInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const { user, workspaceId } = req;
    if (user.role === 'employee') return res.status(403).json({ success: false, message: 'Only admin or owner can delete invoices' });
    const ws = workspaceId ? { workspaceId } : {};
    const inv = await Invoice.findOne({ where: { id, organizationId: user.organizationId, ...ws } });
    if (!inv) return res.status(404).json({ success: false, message: 'Invoice not found' });
    if (parseFloat(inv.paidAmount) > 0) {
      return res.status(400).json({ success: false, message: 'Cannot delete an invoice with recorded payments' });
    }
    await inv.destroy();
    res.json({ success: true, message: 'Invoice deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete invoice' });
  }
};

module.exports = { getInvoices, getInvoice, getPendingByClient, createInvoice, updateInvoice, downloadPDF, sendEmail, whatsappShare, deleteInvoice };
