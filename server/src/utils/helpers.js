const moment = require('moment-timezone');

const IST = 'Asia/Kolkata';

const toIST = (date) => moment(date).tz(IST);

const formatIST = (date, format = 'DD MMM YYYY, hh:mm A') =>
  date ? toIST(date).format(format) : null;

const nowIST = () => moment().tz(IST);

const startOfTodayIST = () => nowIST().startOf('day').toDate();
const endOfTodayIST = () => nowIST().endOf('day').toDate();

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount || 0);

const paginate = (page, limit = 20) => {
  const p = Math.max(1, parseInt(page) || 1);
  const l = Math.min(100, parseInt(limit) || 20);
  return { limit: l, offset: (p - 1) * l, page: p };
};

const paginateResponse = (data, count, page, limit) => ({
  data,
  pagination: {
    total: count,
    page: parseInt(page),
    limit: parseInt(limit),
    totalPages: Math.ceil(count / limit),
  },
});

const generateSlug = (name) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const generateWebhookToken = () => {
  const { v4: uuidv4 } = require('uuid');
  return uuidv4().replace(/-/g, '');
};

const getNextNumber = async (model, field, prefix, workspaceId, organizationId) => {
  const { Op } = require('sequelize');
  const last = await model.findOne({
    where: { organizationId, [field]: { [Op.like]: `${prefix}%` } },
    order: [[field, 'DESC']],
    attributes: [field],
  });
  if (!last) return `${prefix}0001`;
  const num = parseInt(last[field].replace(prefix, ''), 10);
  return `${prefix}${String(num + 1).padStart(4, '0')}`;
};

const calculateLeadScore = (lead) => {
  let score = 0;
  const sourceScores = {
    'Meta Ads': 25, 'Google Ads': 25, 'Website': 20,
    'WhatsApp': 15, 'Reference': 30, 'Telecalling': 10,
    'Social Media': 15, 'CSV Import': 10, 'Instagram DM': 20, 'Justdial': 20, 'Walk-in': 25, 'Other': 5,
  };
  score += sourceScores[lead.source] || 5;

  const statusScores = {
    'New': 0, 'Discussion': 5, 'Meeting': 10,
    'Quotation': 15, 'Won': 20, 'Lost': 0,
  };
  score += statusScores[lead.status] || 0;

  if (lead.email) score += 10;
  if (lead.clientAddress) score += 10;
  if (lead.clientGST) score += 10;

  const priorityBonus = { 'Hot': 15, 'High': 10, 'Medium': 5, 'Low': 0 };
  score += priorityBonus[lead.priority] || 0;

  return Math.min(100, score);
};

const isHotLead = (lead) =>
  lead.score >= 70 || lead.priority === 'Hot';

const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  return input.trim().replace(/<[^>]*>/g, '');
};

const sanitizeObject = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  const sanitized = {};
  for (const [key, val] of Object.entries(obj)) {
    sanitized[key] = typeof val === 'string' ? sanitizeInput(val) : val;
  }
  return sanitized;
};

const successResponse = (res, data, message = 'Success', statusCode = 200) =>
  res.status(statusCode).json({ success: true, message, ...data });

const errorResponse = (res, message = 'An error occurred', statusCode = 500, extra = {}) =>
  res.status(statusCode).json({ success: false, message, ...extra });

const limitReachedResponse = (res, limitType, planName) =>
  res.status(403).json({
    success: false,
    limitReached: true,
    limitType,
    upgradeRequired: true,
    message: `You have reached your ${limitType} limit on the ${planName} plan. Please upgrade to continue.`,
  });

const parseCSVLine = (line, delimiter = ',') => {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
};

const parseCSV = (text) => {
  const cleanText = text.replace(/^﻿/, ''); // strip UTF-8 and UTF-16 BOM
  const lines = cleanText.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };
  const delimiter = lines[0].includes('\t') ? '\t' : ','; // auto-detect TSV vs CSV
  const headers = parseCSVLine(lines[0], delimiter).map((h) => h.toLowerCase().trim());
  const rows = lines.slice(1).map((line) => {
    const values = parseCSVLine(line, delimiter);
    const row = {};
    headers.forEach((h, i) => { row[h] = (values[i] || '').trim(); });
    return row;
  }).filter((row) => Object.values(row).some((v) => v !== ''));
  return { headers, rows };
};

const mapCSVFieldToLead = (headers, row) => {
  const nameKeys = ['name', 'full name', 'fullname', 'customer name', 'client name', 'full_name'];
  const phoneKeys = ['phone', 'mobile', 'phone number', 'contact', 'mobile number'];
  const emailKeys = ['email', 'email address', 'mail'];
  const cityKeys = ['city'];
  const addressKeys = ['address', 'location', 'client address'];
  const sourceKeys = ['source', 'lead source'];
  const campaignKeys = ['campaign', 'campaign name', 'campaign_name'];

  const findValue = (keys) => {
    for (const k of keys) {
      if (row[k] !== undefined && row[k] !== '') return row[k];
    }
    return null;
  };

  const usedKeys = new Set([
    ...nameKeys, ...phoneKeys, ...emailKeys, ...cityKeys, ...addressKeys,
    ...sourceKeys, ...campaignKeys,
  ]);

  const metadata = {};
  for (const [k, v] of Object.entries(row)) {
    if (!usedKeys.has(k) && v !== '') metadata[k] = v;
  }

  const rawPhone = findValue(phoneKeys);
  // Strip "p:" prefix from Meta Ads exports (e.g. "p:+919177914144")
  const phone = rawPhone ? rawPhone.replace(/^p:/i, '').trim() : null;

  return {
    name: findValue(nameKeys),
    phone,
    email: findValue(emailKeys),
    city: findValue(cityKeys),
    clientAddress: findValue(addressKeys),
    source: findValue(sourceKeys) || 'CSV Import',
    campaign: findValue(campaignKeys),
    metadata,
  };
};

module.exports = {
  toIST, formatIST, nowIST, startOfTodayIST, endOfTodayIST, IST,
  formatCurrency, paginate, paginateResponse,
  generateSlug, generateWebhookToken, getNextNumber,
  calculateLeadScore, isHotLead,
  sanitizeInput, sanitizeObject,
  successResponse, errorResponse, limitReachedResponse,
  parseCSV, mapCSVFieldToLead,
};
