const { Op } = require('sequelize');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { Quotation, QuotationItem, Invoice, InvoiceItem, Lead, User, LeadActivity, Organization } = require('../../config/models');
const { getNextNumber, paginate, paginateResponse } = require('../../utils/helpers');
const { generateQuotationPDF } = require('../../services/pdfService');
const emailService = require('../../services/emailService');
const notificationService = require('../../services/notificationService');
const { logUsage } = require('../../middleware/entitlement');

const getQuotations = async (req, res) => {
  try {
    const { user, workspaceId } = req;
    const { page = 1, limit = 20, status, leadId } = req.query;
    const { limit: lim, offset } = paginate(page, limit);
    const where = { organizationId: user.organizationId, workspaceId };
    if (user.role === 'employee') where.createdBy = user.id;
    if (status) where.status = status;
    if (leadId) where.leadId = leadId;

    const { count, rows } = await Quotation.findAndCountAll({
      where,
      include: [
        { model: Lead, as: 'lead', attributes: ['id', 'name'], required: false },
        { model: User, as: 'creator', attributes: ['id', 'name'], required: false },
        { model: QuotationItem, as: 'items', required: false },
      ],
      order: [['createdAt', 'DESC']],
      limit: lim, offset,
    });
    res.json({ success: true, ...paginateResponse(rows, count, page, lim) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch quotations' });
  }
};

const getQuotation = async (req, res) => {
  try {
    const { id } = req.params;
    const { user, workspaceId } = req;
    const q = await Quotation.findOne({
      where: { id, organizationId: user.organizationId, workspaceId },
      include: [
        { model: QuotationItem, as: 'items' },
        { model: Lead, as: 'lead', attributes: ['id', 'name', 'phone', 'email'], required: false },
        { model: User, as: 'creator', attributes: ['id', 'name'], required: false },
        { model: Invoice, as: 'invoice', required: false },
      ],
    });
    if (!q) return res.status(404).json({ success: false, message: 'Quotation not found' });
    res.json({ success: true, quotation: q });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch quotation' });
  }
};

const createQuotation = async (req, res) => {
  try {
    const { user, workspaceId } = req;
    const { leadId, clientName, clientEmail, clientPhone, clientAddress, clientGST, items = [], gstPercent = 18, terms, notes, validUntil } = req.body;

    if (!clientName?.trim()) return res.status(400).json({ success: false, message: 'Client name is required' });
    if (!clientPhone?.trim()) return res.status(400).json({ success: false, message: 'Phone number is required' });
    if (!clientEmail?.trim()) return res.status(400).json({ success: false, message: 'Email is required' });
    if (!clientAddress?.trim()) return res.status(400).json({ success: false, message: 'Address is required' });
    if (!items.length) return res.status(400).json({ success: false, message: 'At least one item is required' });

    let lead = null;
    if (leadId) {
      lead = await Lead.findOne({ where: { id: leadId, organizationId: user.organizationId, workspaceId } });
    } else {
      // Check if a lead already exists with matching phone or email
      const existing = await Lead.findOne({
        where: {
          organizationId: user.organizationId, workspaceId,
          [Op.or]: [
            ...(clientPhone?.trim() ? [{ phone: clientPhone.trim() }] : []),
            ...(clientEmail?.trim() ? [{ email: clientEmail.trim() }] : []),
          ],
        },
      });
      if (existing) {
        lead = existing;
      } else {
        lead = await Lead.create({
          organizationId: user.organizationId, workspaceId,
          name: clientName.trim(), phone: clientPhone.trim(),
          email: clientEmail.trim(), address: clientAddress.trim(),
          source: 'Quotation', status: 'Quotation',
          createdBy: user.id,
        });
      }
    }

    const subtotal = items.reduce((sum, item) => sum + parseFloat(item.quantity || 1) * parseFloat(item.unitPrice || 0), 0);
    const gstAmount = (subtotal * parseFloat(gstPercent)) / 100;
    const totalAmount = subtotal + gstAmount;

    const quotationNumber = await getNextNumber(Quotation, 'quotationNumber', 'QTN-', workspaceId, user.organizationId);

    const q = await Quotation.create({
      organizationId: user.organizationId, workspaceId,
      quotationNumber, leadId: lead?.id || null, createdBy: user.id,
      clientName: clientName || lead?.name, clientEmail: clientEmail || lead?.email,
      clientPhone: clientPhone || lead?.phone, clientAddress: clientAddress || lead?.clientAddress,
      clientGST: clientGST || lead?.clientGST,
      status: 'Draft', subtotal, gstPercent, gstAmount, totalAmount, terms, notes, validUntil,
    });

    const itemsData = items.map((item) => ({
      quotationId: q.id,
      description: item.description,
      quantity: parseFloat(item.quantity) || 1,
      unitPrice: parseFloat(item.unitPrice) || 0,
      totalPrice: parseFloat(item.quantity || 1) * parseFloat(item.unitPrice || 0),
    }));
    await QuotationItem.bulkCreate(itemsData);

    if (lead?.id) {
      await LeadActivity.create({
        leadId: lead.id, organizationId: user.organizationId, workspaceId,
        userId: user.id, type: 'quotation_created',
        description: `Quotation ${quotationNumber} created (₹${totalAmount.toLocaleString('en-IN')})`,
        metadata: { quotationId: q.id },
      });
    }

    res.status(201).json({ success: true, message: 'Quotation created', quotation: q });
  } catch (err) {
    console.error('createQuotation error:', err);
    res.status(500).json({ success: false, message: 'Failed to create quotation' });
  }
};

const updateQuotation = async (req, res) => {
  try {
    const { id } = req.params;
    const { user, workspaceId } = req;
    const q = await Quotation.findOne({ where: { id, organizationId: user.organizationId, workspaceId } });
    if (!q) return res.status(404).json({ success: false, message: 'Quotation not found' });
    if (q.status === 'Approved') return res.status(400).json({ success: false, message: 'Cannot edit an approved quotation' });

    const { items, gstPercent, terms, notes, validUntil, clientName, clientEmail, clientPhone, clientAddress, clientGST } = req.body;

    let updates = {};
    if (clientName) updates.clientName = clientName;
    if (clientEmail) updates.clientEmail = clientEmail;
    if (clientPhone) updates.clientPhone = clientPhone;
    if (clientAddress) updates.clientAddress = clientAddress;
    if (clientGST) updates.clientGST = clientGST;
    if (terms !== undefined) updates.terms = terms;
    if (notes !== undefined) updates.notes = notes;
    if (validUntil) updates.validUntil = validUntil;

    if (items && items.length) {
      const subtotal = items.reduce((sum, i) => sum + parseFloat(i.quantity || 1) * parseFloat(i.unitPrice || 0), 0);
      const gst = parseFloat(gstPercent || q.gstPercent);
      const gstAmount = (subtotal * gst) / 100;
      updates.subtotal = subtotal;
      updates.gstPercent = gst;
      updates.gstAmount = gstAmount;
      updates.totalAmount = subtotal + gstAmount;

      await QuotationItem.destroy({ where: { quotationId: id } });
      await QuotationItem.bulkCreate(items.map((i) => ({
        quotationId: id, description: i.description,
        quantity: parseFloat(i.quantity) || 1, unitPrice: parseFloat(i.unitPrice) || 0,
        totalPrice: (parseFloat(i.quantity) || 1) * (parseFloat(i.unitPrice) || 0),
      })));
    }

    await q.update(updates);
    res.json({ success: true, message: 'Quotation updated', quotation: q });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update quotation' });
  }
};

const updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { user, workspaceId } = req;
    const { status } = req.body;
    const q = await Quotation.findOne({
      where: { id, organizationId: user.organizationId, workspaceId },
      include: [{ model: QuotationItem, as: 'items' }],
    });
    if (!q) return res.status(404).json({ success: false, message: 'Quotation not found' });

    const updates = { status };
    if (status === 'Sent') updates.sentAt = new Date();
    if (status === 'Approved') updates.approvedAt = new Date();
    await q.update(updates);

    if (status === 'Approved') {
      const invNumber = await getNextNumber(Invoice, 'invoiceNumber', 'INV-', workspaceId, user.organizationId);
      const inv = await Invoice.create({
        organizationId: user.organizationId, workspaceId, invoiceNumber: invNumber,
        quotationId: q.id, leadId: q.leadId, createdBy: user.id,
        clientName: q.clientName, clientEmail: q.clientEmail,
        clientPhone: q.clientPhone, clientAddress: q.clientAddress, clientGST: q.clientGST,
        subtotal: q.subtotal, gstPercent: q.gstPercent, gstAmount: q.gstAmount,
        totalAmount: q.totalAmount, paidAmount: 0, dueAmount: q.totalAmount,
        status: 'Unpaid',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      if (q.items && q.items.length) {
        await InvoiceItem.bulkCreate(q.items.map((item) => ({
          invoiceId: inv.id,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
        })));
      }

      if (q.leadId) {
        await LeadActivity.create({
          leadId: q.leadId, organizationId: user.organizationId, workspaceId,
          userId: user.id, type: 'invoice_generated',
          description: `Invoice ${invNumber} generated from quotation ${q.quotationNumber}`,
          metadata: { invoiceId: inv.id, quotationId: q.id },
        });
      }
      await notificationService.notifyQuotationApproved({ quotation: q, creatorId: q.createdBy, organizationId: user.organizationId, workspaceId });
    }

    res.json({ success: true, message: 'Status updated', quotation: q });
  } catch (err) {
    console.error('updateQuotationStatus error:', err);
    res.status(500).json({ success: false, message: 'Failed to update status' });
  }
};

const downloadPDF = async (req, res) => {
  try {
    const { id } = req.params;
    const { user, workspaceId } = req;
    const q = await Quotation.findOne({
      where: { id, organizationId: user.organizationId, workspaceId },
      include: [{ model: QuotationItem, as: 'items' }],
    });
    if (!q) return res.status(404).json({ success: false, message: 'Quotation not found' });

    const org = await Organization.findByPk(user.organizationId, { attributes: ['settings'] });
    const pdf = await generateQuotationPDF(q, q.items, org?.settings);
    await logUsage(user.organizationId, workspaceId, 'pdf_generated');

    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${q.quotationNumber}.pdf"` });
    res.send(pdf);
  } catch (err) {
    console.error('downloadQuotationPDF error:', err);
    res.status(500).json({ success: false, message: 'Failed to generate PDF' });
  }
};

const sendEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const { user, workspaceId } = req;
    const q = await Quotation.findOne({
      where: { id, organizationId: user.organizationId, workspaceId },
      include: [{ model: QuotationItem, as: 'items' }],
    });
    if (!q) return res.status(404).json({ success: false, message: 'Quotation not found' });
    if (!q.clientEmail) return res.status(400).json({ success: false, message: 'Client email not set' });

    const org = await Organization.findByPk(user.organizationId, { attributes: ['settings'] });
    const pdf = await generateQuotationPDF(q, q.items, org?.settings);
    const result = await emailService.sendQuotationEmail(q, q.items, pdf, org?.settings, org?.settings?.smtpConfig);

    if (result.success) {
      await q.update({ status: q.status === 'Draft' ? 'Sent' : q.status, sentAt: q.sentAt || new Date() });
      res.json({ success: true, message: 'Quotation email sent' });
    } else {
      res.status(500).json({ success: false, message: 'Failed to send email', error: result.error });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to send quotation email' });
  }
};

const whatsappShare = async (req, res) => {
  try {
    const { id } = req.params;
    const { user, workspaceId } = req;
    const q = await Quotation.findOne({
      where: { id, organizationId: user.organizationId, workspaceId },
      include: [{ model: QuotationItem, as: 'items' }],
    });
    if (!q) return res.status(404).json({ success: false, message: 'Quotation not found' });

    const org = await Organization.findByPk(user.organizationId, { attributes: ['settings'] });
    const pdf = await generateQuotationPDF(q, q.items, org?.settings);

    const sharedDir = path.join(__dirname, '..', '..', '..', 'uploads', 'shared');
    fs.mkdirSync(sharedDir, { recursive: true });

    const fileName = `${uuidv4()}.pdf`;
    fs.writeFileSync(path.join(sharedDir, fileName), pdf);

    res.json({ success: true, fileName, phone: q.clientPhone, clientName: q.clientName, number: q.quotationNumber, totalAmount: q.totalAmount });
  } catch (err) {
    console.error('whatsappShare quotation error:', err);
    res.status(500).json({ success: false, message: 'Failed to generate share link' });
  }
};

module.exports = { getQuotations, getQuotation, createQuotation, updateQuotation, updateStatus, downloadPDF, sendEmail, whatsappShare };
