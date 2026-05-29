const PDFDocument = require('pdfkit');
const moment = require('moment-timezone');

const IST = 'Asia/Kolkata';
const PRIMARY = '#E7C51C';
const PRIMARY_DARK = '#1a1a2e';
const ACCENT_BG = '#fffef0';
const LIGHT_GRAY = '#f5f5f5';
const GRAY = '#888888';
const BLACK = '#000000';
const WHITE = '#ffffff';

const drawLine = (doc, y, color = '#dddddd') => {
  doc.strokeColor(color).lineWidth(0.5).moveTo(50, y).lineTo(545, y).stroke();
};

const addHeader = (doc, orgSettings, type) => {
  const branding = orgSettings?.branding || {};
  const companyName = branding.companyName || process.env.COMPANY_NAME || 'Agency';
  const address = branding.address || process.env.COMPANY_ADDRESS || '';
  const gst = branding.gst || process.env.COMPANY_GST || '';
  const phone = branding.phone || process.env.COMPANY_PHONE || '';
  const email = branding.email || process.env.COMPANY_EMAIL || '';
  const website = branding.website || process.env.COMPANY_WEBSITE || '';

  doc.rect(0, 0, doc.page.width, 120).fill(PRIMARY);
  doc.fontSize(22).fillColor(PRIMARY_DARK).font('Helvetica-Bold').text(companyName, 50, 30, { width: 300 });
  doc.fontSize(9).fillColor('#5a4a00').font('Helvetica');
  if (address) doc.text(address, 50, 58, { width: 300 });
  if (gst) doc.text(`GST: ${gst}`, 50, 70, { width: 300 });
  if (phone || email) doc.text(`${phone}  ${email}`, 50, 82, { width: 300 });
  if (website) doc.text(website, 50, 94, { width: 300 });

  doc.fontSize(28).fillColor(PRIMARY_DARK).font('Helvetica-Bold').text(type.toUpperCase(), 350, 35, { align: 'right', width: 195 });
  doc.moveDown(0.5);
};

const addClientSection = (doc, clientData, docData, type) => {
  const y = 135;
  doc.rect(50, y, 240, 85).fill(LIGHT_GRAY);
  doc.rect(305, y, 240, 85).fill(LIGHT_GRAY);

  doc.fontSize(8).fillColor(GRAY).font('Helvetica-Bold').text('BILL TO', 60, y + 10);
  doc.fontSize(11).fillColor(BLACK).font('Helvetica-Bold').text(clientData.name || '', 60, y + 22);
  doc.fontSize(9).fillColor('#333').font('Helvetica');
  if (clientData.email) doc.text(clientData.email, 60, y + 36);
  if (clientData.phone) doc.text(clientData.phone, 60, y + 48);
  if (clientData.address) doc.text(clientData.address, 60, y + 60, { width: 225 });
  if (clientData.gst) doc.text(`GST: ${clientData.gst}`, 60, y + 72);

  doc.fontSize(8).fillColor(GRAY).font('Helvetica-Bold').text(`${type.toUpperCase()} DETAILS`, 315, y + 10);
  doc.fontSize(9).fillColor('#333').font('Helvetica');
  doc.text(`${type} #:`, 315, y + 22).font('Helvetica-Bold').text(docData.number, 395, y + 22);
  doc.font('Helvetica').text('Date:', 315, y + 35).font('Helvetica-Bold').text(moment().tz(IST).format('DD MMM YYYY'), 395, y + 35);
  if (docData.dueDate) {
    doc.font('Helvetica').text('Due Date:', 315, y + 48).font('Helvetica-Bold').text(moment(docData.dueDate).tz(IST).format('DD MMM YYYY'), 395, y + 48);
  }
  if (docData.validUntil) {
    doc.font('Helvetica').text('Valid Until:', 315, y + 48).font('Helvetica-Bold').text(moment(docData.validUntil).tz(IST).format('DD MMM YYYY'), 395, y + 48);
  }
  if (docData.status) {
    doc.font('Helvetica').text('Status:', 315, y + 61).font('Helvetica-Bold').fillColor(PRIMARY_DARK).text(docData.status, 395, y + 61);
  }

  return y + 95;
};

const addItemsTable = (doc, items, startY) => {
  const tableY = startY + 10;
  const colWidths = [240, 55, 90, 90];
  const colX = [50, 295, 355, 450];
  const headers = ['DESCRIPTION', 'QTY', 'UNIT PRICE', 'TOTAL'];

  doc.rect(50, tableY, 495, 22).fill(PRIMARY);
  doc.fontSize(9).fillColor(PRIMARY_DARK).font('Helvetica-Bold');
  headers.forEach((h, i) => {
    doc.text(h, colX[i] + 5, tableY + 7, { width: colWidths[i] - 10, align: i > 0 ? 'right' : 'left' });
  });

  let currentY = tableY + 22;
  items.forEach((item, idx) => {
    const rowHeight = 24;
    if (idx % 2 === 0) doc.rect(50, currentY, 495, rowHeight).fill(ACCENT_BG);
    doc.fontSize(9).fillColor(BLACK).font('Helvetica');
    doc.text(item.description || '', colX[0] + 5, currentY + 8, { width: colWidths[0] - 10 });
    doc.text(String(parseFloat(item.quantity || 1)), colX[1] + 5, currentY + 8, { width: colWidths[1] - 10, align: 'right' });
    doc.text(`Rs. ${parseFloat(item.unitPrice || 0).toLocaleString('en-IN')}`, colX[2] + 5, currentY + 8, { width: colWidths[2] - 10, align: 'right' });
    doc.text(`Rs. ${parseFloat(item.totalPrice || 0).toLocaleString('en-IN')}`, colX[3] + 5, currentY + 8, { width: colWidths[3] - 10, align: 'right' });
    currentY += rowHeight;
  });

  return currentY;
};

const addTotals = (doc, data, startY) => {
  const totalY = startY + 10;
  const labelX = 350;
  const valueX = 450;
  let y = totalY;

  drawLine(doc, y);
  y += 8;

  const addTotalRow = (label, value, bold = false, color = BLACK) => {
    doc.fontSize(10).fillColor(GRAY).font(bold ? 'Helvetica-Bold' : 'Helvetica').text(label, labelX, y, { width: 90, align: 'right' });
    doc.fillColor(color).font(bold ? 'Helvetica-Bold' : 'Helvetica').text(`Rs. ${parseFloat(value || 0).toLocaleString('en-IN')}`, valueX, y, { width: 95, align: 'right' });
    y += 18;
  };

  addTotalRow('Subtotal:', data.subtotal);
  addTotalRow(`GST (${data.gstPercent || 18}%):`, data.gstAmount);

  drawLine(doc, y);
  y += 8;
  addTotalRow('TOTAL:', data.totalAmount, true, PRIMARY_DARK);


  return y + 10;
};

const addFooter = (doc, data) => {
  const footerY = doc.page.height - 120;
  drawLine(doc, footerY);

  if (data.terms) {
    doc.fontSize(8).fillColor(GRAY).font('Helvetica-Bold').text('TERMS & CONDITIONS', 50, footerY + 10);
    doc.fontSize(8).fillColor('#555').font('Helvetica').text(data.terms, 50, footerY + 22, { width: 495 });
  }
  if (data.notes) {
    doc.fontSize(8).fillColor(GRAY).font('Helvetica-Bold').text('NOTES', 50, footerY + 50);
    doc.fontSize(8).fillColor('#555').font('Helvetica').text(data.notes, 50, footerY + 62, { width: 495 });
  }

  doc.fontSize(8).fillColor(GRAY).text('Thank you for your business!', 50, doc.page.height - 30, { align: 'center', width: 495 });
};

const generateQuotationPDF = (quotation, items, orgSettings) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ margin: 0, size: 'A4' });
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    addHeader(doc, orgSettings, 'Quotation');
    const clientY = addClientSection(doc, {
      name: quotation.clientName, email: quotation.clientEmail,
      phone: quotation.clientPhone, address: quotation.clientAddress,
      gst: quotation.clientGST,
    }, {
      number: quotation.quotationNumber, validUntil: quotation.validUntil,
      status: quotation.status,
    }, 'Quotation');

    const itemsEndY = addItemsTable(doc, items || [], clientY);
    const totalsEndY = addTotals(doc, quotation, itemsEndY);
    addFooter(doc, quotation);
    doc.end();
  });

const generateInvoicePDF = (invoice, orgSettings, invoiceItems) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ margin: 0, size: 'A4' });
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const items = invoiceItems || [];

    addHeader(doc, orgSettings, 'Invoice');
    const clientY = addClientSection(doc, {
      name: invoice.clientName, email: invoice.clientEmail,
      phone: invoice.clientPhone, address: invoice.clientAddress,
      gst: invoice.clientGST,
    }, {
      number: invoice.invoiceNumber, dueDate: invoice.dueDate,
      status: invoice.status,
    }, 'Invoice');

    const itemsEndY = addItemsTable(doc, items, clientY);
    const totalsEndY = addTotals(doc, invoice, itemsEndY);
    addFooter(doc, invoice);
    doc.end();
  });

module.exports = { generateQuotationPDF, generateInvoicePDF };
