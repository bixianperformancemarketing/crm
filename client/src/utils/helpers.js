export const ENUMS = {
  LEAD_SOURCES: ['Meta Ads', 'Google Ads', 'Website', 'WhatsApp', 'Reference', 'Telecalling', 'Social Media', 'CSV Import', 'Instagram DM', 'Justdial', 'Walk-in', 'Cold visit', 'Other'],
  LEAD_STATUSES: ['New', 'Discussion', 'Meeting', 'Quotation', 'Review', 'Won', 'Lost'],
  LEAD_PRIORITIES: ['Hot', 'Warm', 'Cold'],

  APPOINTMENT_TYPES: ['Call', 'Meeting', 'Demo', 'Site Visit', 'Follow-up', 'Other'],
  APPOINTMENT_STATUSES: ['Scheduled', 'Completed', 'Cancelled', 'No Show'],
  CONTENT_PLATFORMS: ['Instagram', 'Facebook', 'LinkedIn', 'YouTube', 'Twitter/X', 'Website', 'Google', 'WhatsApp', 'Other'],
  CONTENT_TYPES: ['Post', 'Story', 'Reel', 'Video', 'Blog', 'Ad Creative', 'Banner', 'Logo', 'Brochure', 'Other'],
  CONTENT_STATUSES: ['Pending', 'In Progress', 'Review', 'Approved', 'Published', 'Rejected'],
  PAYMENT_MODES: ['UPI', 'Bank Transfer', 'Cash', 'Cheque', 'Online'],
  ROLES: ['employee', 'admin'],
  PLANS: ['trial', 'starter', 'growth', 'agency', 'custom'],
};

export const formatCurrency = (amount) => {
  if (amount == null || isNaN(amount)) return '₹0';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
};

export const formatDate = (date) => {
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date(date));
};

export const formatDateTime = (date) => {
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }).format(new Date(date));
};

export const formatTime = (date) => {
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }).format(new Date(date));
};

export const timeAgo = (date) => {
  if (!date) return '';
  const seconds = Math.floor((Date.now() - new Date(date)) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return formatDate(date);
};

export const getStatusColor = (status) => {
  const map = {
    New: '#0ea5e9', Discussion: '#f59e0b', Meeting: '#7c3aed',
    Quotation: '#e94560', Review: '#f97316', Won: '#22c55e', Lost: '#6b7280',
    pending: '#f59e0b', completed: '#22c55e', overdue: '#ef4444', cancelled: '#6b7280',
    Scheduled: '#0ea5e9', Completed: '#22c55e', Cancelled: '#6b7280', 'No Show': '#ef4444',
    Draft: '#6b7280', Sent: '#0ea5e9', Approved: '#22c55e', Rejected: '#ef4444',
    Unpaid: '#ef4444', Partial: '#f59e0b', Paid: '#22c55e', Overdue: '#e94560',
    Pending: '#f59e0b', 'In Progress': '#0ea5e9', Review: '#7c3aed', Published: '#22c55e',
    trial: '#6b7280', starter: '#0ea5e9', growth: '#7c3aed', agency: '#e94560', custom: '#22c55e',
  };
  return map[status] || '#6b7280';
};

export const getPriorityColor = (priority) => {
  const map = { Hot: '#22c55e', Warm: '#f59e0b', Cold: '#ef4444', Low: '#6b7280', Medium: '#0ea5e9', High: '#f59e0b' };
  return map[priority] || '#6b7280';
};

export const getPriorityBg = (priority) => {
  const map = { Hot: 'rgba(34,197,94,0.15)', Warm: 'rgba(245,158,11,0.15)', Cold: 'rgba(239,68,68,0.15)', Low: 'rgba(107,114,128,0.15)', Medium: 'rgba(14,165,233,0.15)', High: 'rgba(245,158,11,0.15)' };
  return map[priority] || 'rgba(107,114,128,0.15)';
};

export const getInitials = (name) => {
  if (!name) return '?';
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
};

export const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const debounce = (fn, delay) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
};

export const truncate = (str, len = 50) => {
  if (!str) return '';
  return str.length > len ? str.slice(0, len) + '...' : str;
};

export const getMonthName = (month) => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[(parseInt(month) - 1) % 12] || '';
};

export const buildMonthlyChartData = (data, months = 12) => {
  const now = new Date();
  const labels = [];
  const values = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    labels.push(getMonthName(d.getMonth() + 1) + ' ' + d.getFullYear());
    const found = data.find((r) => parseInt(r.month) === d.getMonth() + 1 && parseInt(r.year) === d.getFullYear());
    values.push(found ? parseFloat(found.total || found.count || 0) : 0);
  }
  return { labels, values };
};
