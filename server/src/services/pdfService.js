const PDFDocument = require('pdfkit');
const moment = require('moment-timezone');
const axios = require('axios');

const fetchImageBuffer = async (url) => {
  if (!url || !url.trim()) return null;
  try {
    if (url.startsWith('data:')) return Buffer.from(url.split(',')[1], 'base64');
    const res = await axios.get(url.trim(), { responseType: 'arraybuffer', timeout: 5000 });
    return Buffer.from(res.data);
  } catch { return null; }
};

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
  const phone2 = branding.phone2 || '';
  const email = branding.email || process.env.COMPANY_EMAIL || '';
  const website = branding.website || process.env.COMPANY_WEBSITE || '';

  doc.rect(0, 0, doc.page.width, 130).fill(PRIMARY);
  doc.fontSize(22).fillColor(PRIMARY_DARK).font('Helvetica-Bold').text(companyName, 50, 30, { width: 340 });
  doc.fontSize(9).fillColor('#5a4a00').font('Helvetica');
  if (address) doc.text(address, 50, 58, { width: 340 });
  if (gst) doc.text(`GST: ${gst}`, 50, 70, { width: 340 });
  if (phone || phone2) doc.text([phone, phone2].filter(Boolean).join('  /  '), 50, 82, { width: 340 });
  if (email) doc.text(email, 50, 94, { width: 340 });
  if (website) doc.text(website, 50, 106, { width: 340 });

  doc.fontSize(16).fillColor(PRIMARY_DARK).font('Helvetica-Bold').text(type.toUpperCase(), 395, 40, { align: 'right', width: 150 });
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

  return y + 95;
};

const parseTerms = (raw) => {
  if (!raw) return [];
  try {
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p.filter(t => t && t.trim()) : (raw.trim() ? [raw] : []);
  } catch { return raw.trim() ? [raw] : []; }
};

const addTermsAndPayment = (doc, bankDetails, termsRaw, startY, qrBuffer = null) => {
  const terms = parseTerms(termsRaw);
  const bankFields = [
    bankDetails?.bankName      && ['Bank',        bankDetails.bankName],
    bankDetails?.accountHolder && ['A/C Holder',  bankDetails.accountHolder],
    bankDetails?.accountNumber && ['Account No.', bankDetails.accountNumber],
    bankDetails?.ifscCode      && ['IFSC',        bankDetails.ifscCode],
  ].filter(Boolean);

  const hasBank  = bankFields.length > 0;
  const hasTerms = terms.length > 0;
  if (!hasBank && !hasTerms) return startY;

  const QR_SIZE = 58;
  const boxY    = startY + 14;
  const termH   = hasTerms ? terms.length * 14 + 28 : 0;
  const bankH   = hasBank  ? bankFields.length * 13 + 28 + (qrBuffer ? QR_SIZE + 14 : 0) : 0;
  const boxH    = Math.max(termH, bankH, 52);

  if (hasBank && hasTerms) {
    doc.rect(50,  boxY, 240, boxH).fill(LIGHT_GRAY);
    doc.rect(305, boxY, 240, boxH).fill(LIGHT_GRAY);

    doc.fontSize(8).fillColor(GRAY).font('Helvetica-Bold').text('PAYMENT DETAILS', 60, boxY + 10);
    let by = boxY + 24;
    bankFields.forEach(([label, value]) => {
      doc.fontSize(7.5).fillColor(GRAY).font('Helvetica').text(`${label}:`, 60, by, { width: 68 });
      doc.fontSize(7.5).fillColor(BLACK).font('Helvetica-Bold').text(value, 130, by, { width: 150 });
      by += 13;
    });
    if (qrBuffer) {
      try {
        const qrX = 50 + (240 - QR_SIZE) / 2;
        doc.fontSize(7).fillColor(GRAY).font('Helvetica').text('Scan to Pay', 60, by + 8, { width: 220, align: 'center' });
        doc.image(qrBuffer, qrX, by + 18, { fit: [QR_SIZE, QR_SIZE] });
      } catch {}
    }

    doc.fontSize(8).fillColor(GRAY).font('Helvetica-Bold').text('TERMS & CONDITIONS', 315, boxY + 10);
    let ty = boxY + 24;
    terms.forEach(term => {
      doc.fontSize(8).fillColor(BLACK).font('Helvetica').text(`•  ${term}`, 315, ty, { width: 225 });
      ty += 14;
    });

  } else if (hasBank) {
    doc.rect(50, boxY, 495, boxH).fill(LIGHT_GRAY);
    doc.fontSize(8).fillColor(GRAY).font('Helvetica-Bold').text('PAYMENT DETAILS', 60, boxY + 10);
    let by = boxY + 24;
    bankFields.forEach(([label, value]) => {
      doc.fontSize(7.5).fillColor(GRAY).font('Helvetica').text(`${label}:`, 60, by, { width: 68 });
      doc.fontSize(7.5).fillColor(BLACK).font('Helvetica-Bold').text(value, 130, by, { width: 200 });
      by += 13;
    });
    if (qrBuffer) {
      try {
        const qrX = 380;
        doc.fontSize(7).fillColor(GRAY).font('Helvetica').text('Scan to Pay', qrX, boxY + 10, { width: QR_SIZE + 20, align: 'center' });
        doc.image(qrBuffer, qrX + 10, boxY + 20, { fit: [QR_SIZE, QR_SIZE] });
      } catch {}
    }

  } else {
    doc.rect(50, boxY, 495, boxH).fill(LIGHT_GRAY);
    doc.fontSize(8).fillColor(GRAY).font('Helvetica-Bold').text('TERMS & CONDITIONS', 60, boxY + 10);
    let ty = boxY + 24;
    terms.forEach(term => {
      doc.fontSize(8).fillColor(BLACK).font('Helvetica').text(`•  ${term}`, 60, ty, { width: 470 });
      ty += 14;
    });
  }

  return boxY + boxH + 8;
};

const addItemsTable = (doc, items, startY) => {
  const tableY = startY + 10;
  const cols = [
    { x: 50, w: 235, label: 'SERVICE', align: 'left' },
    { x: 290, w: 155, label: 'DELIVERABLES', align: 'center' },
    { x: 450, w: 95, label: 'AMOUNT', align: 'right' },
  ];

  doc.rect(50, tableY, 495, 22).fill(PRIMARY);
  doc.fontSize(9).fillColor(PRIMARY_DARK).font('Helvetica-Bold');
  cols.forEach((col) => {
    doc.text(col.label, col.x + 5, tableY + 7, { width: col.w - 10, align: col.align });
  });

  let currentY = tableY + 22;

  items.forEach((item, idx) => {
    // Calculate left-column height
    doc.fontSize(9).font('Helvetica-Bold');
    const descH = doc.heightOfString(item.description || '', { width: cols[0].w - 10 });
    doc.fontSize(8).font('Helvetica');
    const subDescH = item.subDescription
      ? doc.heightOfString(item.subDescription, { width: cols[0].w - 10 }) + 4
      : 0;

    // Format deliverables
    const subItemsText = (item.subItems || [])
      .filter((si) => si.label || si.qty)
      .map((si) => {
        const qty = si.qty ? Number(si.qty).toLocaleString('en-IN') : '';
        return `${qty} ${si.label || ''}`.trim();
      })
      .join('  •  ');
    const siH = subItemsText
      ? doc.heightOfString(subItemsText, { width: cols[1].w - 10 }) + 4
      : 0;

    const rowH = Math.max(descH + subDescH, siH, 18) + 16;

    if (idx % 2 === 0) doc.rect(50, currentY, 495, rowH).fill(ACCENT_BG);

    // Service name
    doc.fontSize(9).fillColor(BLACK).font('Helvetica-Bold');
    doc.text(item.description || '', cols[0].x + 5, currentY + 8, { width: cols[0].w - 10 });

    // Sub-description
    if (item.subDescription) {
      doc.fontSize(9).font('Helvetica-Bold');
      const mainH = doc.heightOfString(item.description || '', { width: cols[0].w - 10 });
      doc.fontSize(8).fillColor(GRAY).font('Helvetica');
      doc.text(item.subDescription, cols[0].x + 5, currentY + 8 + mainH + 2, { width: cols[0].w - 10 });
    }

    // Deliverables
    if (subItemsText) {
      doc.fontSize(8).fillColor('#333').font('Helvetica');
      doc.text(subItemsText, cols[1].x + 5, currentY + 8, { width: cols[1].w - 10, align: 'center' });
    }

    // Amount
    doc.fontSize(10).fillColor(BLACK).font('Helvetica-Bold');
    doc.text(`Rs. ${parseFloat(item.totalPrice || 0).toLocaleString('en-IN')}`, cols[2].x + 5, currentY + 8, { width: cols[2].w - 10, align: 'right' });

    currentY += rowH;
    drawLine(doc, currentY, '#eeeeee');
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

  const paidAmt = parseFloat(data.paidAmount || 0);
  if (paidAmt > 0) {
    y += 4;
    addTotalRow('Paid Amount:', paidAmt, false, '#22c55e');
    const due = Math.max(0, parseFloat(data.totalAmount) - paidAmt);
    drawLine(doc, y);
    y += 8;
    addTotalRow('AMOUNT DUE:', due, true, '#ef4444');
  }

  if (data.status) {
    y += 6;
    const statusColor = data.status === 'Paid' ? '#22c55e' : data.status === 'Partial' ? '#f59e0b' : data.status === 'Overdue' ? '#ef4444' : '#6b7280';
    doc.fontSize(9).fillColor(GRAY).font('Helvetica').text('Status:', labelX, y, { width: 90, align: 'right' });
    doc.fillColor(statusColor).font('Helvetica-Bold').text(data.status, valueX, y, { width: 95, align: 'right' });
    y += 18;
  }

  return y + 10;
};

const addFooter = (doc, data, orgSettings, logoBuffer, signatureBuffer, type, customMessage) => {
  const branding = orgSettings?.branding || {};
  const bankDetails = orgSettings?.bankDetails || {};
  const signatoryName = branding.signatoryName || '';
  const signatoryDesignation = branding.signatoryDesignation || '';
  const hasBankDetails = false; // bank details now shown as a body section, not in footer

  const footerY = doc.page.height - 130;

  // Yellow background — mirrors the header
  doc.rect(0, footerY, doc.page.width, doc.page.height - footerY).fill(PRIMARY);

  const TEXT_DARK = PRIMARY_DARK;   // #1a1a2e — headings on yellow
  const TEXT_MID  = '#5a4a00';      // dark amber — secondary text on yellow
  const LINE_COLOR = 'rgba(26,26,46,0.25)';

  // Thin separator line at top of footer
  doc.strokeColor(TEXT_DARK).lineWidth(0.5).opacity(0.3)
    .moveTo(50, footerY + 1).lineTo(545, footerY + 1).stroke();
  doc.opacity(1);

  // ── Left column: Logo + company name ────────────────────────────────────
  let leftY = footerY + 14;
  if (logoBuffer) {
    try {
      doc.image(logoBuffer, 50, leftY, { height: 34, fit: [110, 34] });
      leftY += 40;
    } catch {}
  }
  const companyName = branding.companyName || '';
  if (companyName) {
    doc.fontSize(9).fillColor(TEXT_DARK).font('Helvetica-Bold').text(companyName, 50, leftY, { width: 145 });
    leftY += 13;
  }
  if (branding.phone || branding.phone2) {
    const phones = [branding.phone, branding.phone2].filter(Boolean).join('  /  ');
    doc.fontSize(7.5).fillColor(TEXT_MID).font('Helvetica').text(phones, 50, leftY, { width: 145 }); leftY += 11;
  }
  if (branding.email)   { doc.fontSize(7.5).fillColor(TEXT_MID).font('Helvetica').text(branding.email,   50, leftY, { width: 145 }); leftY += 11; }
  if (branding.website) { doc.fontSize(7.5).fillColor(TEXT_MID).font('Helvetica').text(branding.website, 50, leftY, { width: 145 }); }

  // ── Middle column: Bank details (invoice) or Terms (quotation) ──────────
  const midX = 215;
  const midWidth = 170;
  let midY = footerY + 14;

  // Payment details and terms are shown in the body section above the footer

  // ── Right column: Signature + signatory ─────────────────────────────────
  const rightX = 400;
  const rightWidth = 145;
  let rightY = footerY + 14;

  if (signatureBuffer) {
    try {
      doc.image(signatureBuffer, rightX, rightY, { fit: [rightWidth, 38], align: 'center' });
      rightY += 44;
    } catch { rightY += 10; }
  } else {
    doc.strokeColor(TEXT_DARK).lineWidth(0.5).opacity(0.4)
      .moveTo(rightX + 10, rightY + 32).lineTo(rightX + rightWidth - 10, rightY + 32).stroke();
    doc.opacity(1);
    rightY += 38;
  }
  doc.fontSize(8).fillColor(TEXT_DARK).font('Helvetica-Bold').text('Authorized Signatory', rightX, rightY, { width: rightWidth, align: 'center' });
  rightY += 12;
  if (signatoryName) {
    doc.fontSize(8).fillColor(TEXT_DARK).font('Helvetica-Bold').text(signatoryName, rightX, rightY, { width: rightWidth, align: 'center' });
    rightY += 11;
  }
  if (signatoryDesignation) {
    doc.fontSize(7.5).fillColor(TEXT_MID).font('Helvetica').text(signatoryDesignation, rightX, rightY, { width: rightWidth, align: 'center' });
  }

  // ── Bottom strip: notes + thank-you ─────────────────────────────────────
  const stripY = doc.page.height - 22;
  doc.strokeColor(TEXT_DARK).lineWidth(0.5).opacity(0.15)
    .moveTo(50, stripY - 5).lineTo(545, stripY - 5).stroke();
  doc.opacity(1);

  const defaultMsg = type === 'Invoice'
    ? 'Thank you for accepting us to achieve your missions.'
    : 'We will be happy to help you to achieve your missions.';
  const footerMsg = customMessage || defaultMsg;
  doc.fontSize(8).fillColor(TEXT_DARK).font('Helvetica-Bold').text(footerMsg, 50, stripY, { align: 'center', width: 495 });
};

const generateQuotationPDF = async (quotation, items, orgSettings) => {
  const branding = orgSettings?.branding || {};
  const bankDetails = orgSettings?.bankDetails || {};
  const [logoBuffer, signatureBuffer, qrBuffer] = await Promise.all([
    fetchImageBuffer(branding.logo),
    fetchImageBuffer(branding.signature),
    fetchImageBuffer(bankDetails.qrCode),
  ]);

  return new Promise((resolve, reject) => {
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
    addTermsAndPayment(doc, bankDetails, quotation.terms, totalsEndY, qrBuffer);
    addFooter(doc, quotation, orgSettings, logoBuffer, signatureBuffer, 'Quotation', orgSettings?.messages?.quotationFooter || '');
    doc.end();
  });
};

const generateInvoicePDF = async (invoice, orgSettings, invoiceItems) => {
  const branding = orgSettings?.branding || {};
  const bankDetails = orgSettings?.bankDetails || {};
  const [logoBuffer, signatureBuffer, qrBuffer] = await Promise.all([
    fetchImageBuffer(branding.logo),
    fetchImageBuffer(branding.signature),
    fetchImageBuffer(bankDetails.qrCode),
  ]);

  return new Promise((resolve, reject) => {
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
    addTermsAndPayment(doc, bankDetails, invoice.terms, totalsEndY, qrBuffer);
    addFooter(doc, invoice, orgSettings, logoBuffer, signatureBuffer, 'Invoice', orgSettings?.messages?.invoiceFooter || '');
    doc.end();
  });
};

module.exports = { generateQuotationPDF, generateInvoicePDF };
