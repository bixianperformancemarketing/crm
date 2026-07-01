import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import Layout from '../components/layout/Layout';
import Pagination from '../components/common/Pagination';
import UpgradeModal from '../components/common/UpgradeModal';
import { invoicesAPI, paymentsAPI, orgAPI } from '../services/api';
import { formatCurrency, formatDate, getStatusColor, downloadBlob } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';
import { ENUMS } from '../utils/helpers';
import DateFilter from '../components/common/DateFilter';
import './Invoices.css';

const emptyItem = () => ({ description: '', subDescription: '', subItems: [], totalPrice: '' });
const emptyForm = () => ({ title: '', clientName: '', clientEmail: '', clientPhone: '', clientAddress: '', clientGST: '', gstPercent: 18, terms: [], dueDate: '', workspaceId: '', items: [emptyItem()] });
const parseTermsArray = (raw) => {
  if (!raw) return [];
  try { const p = JSON.parse(raw); return Array.isArray(p) ? p : (raw ? [raw] : []); }
  catch { return raw ? [raw] : []; }
};

const Invoices = () => {
  const { user, hasFeature, org } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [dueDateSort, setDueDateSort] = useState('');
  const [upgradeModal, setUpgradeModal] = useState(null);
  const [showPayment, setShowPayment] = useState(null);
  const [payForm, setPayForm] = useState({ amount: '', mode: 'UPI', reference: '', note: '' });
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [sendingEmail, setSendingEmail] = useState(null);
  const [sendingWhatsapp, setSendingWhatsapp] = useState(null);
  const [editInvoice, setEditInvoice] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);

  useEffect(() => {
    if (user?.role === 'owner') {
      orgAPI.getWorkspaces().then(r => setWorkspaces(r.data?.workspaces || r.data || [])).catch(() => {});
    }
  }, [user?.role]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page };
      if (statusFilter) params.status = statusFilter;
      if (search.trim()) params.search = search.trim();
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      if (dueDateSort) params.dueDateSort = dueDateSort;
      const { data } = await invoicesAPI.getAll(params);
      setInvoices(data.data || []);
      setPagination(data.pagination);
    } catch { toast.error('Failed to load invoices'); }
    finally { setLoading(false); }
  }, [page, statusFilter, search, dateFrom, dateTo, dueDateSort]);

  useEffect(() => { load(); }, [load]);

  const updateItem = (i, field, val) => {
    const items = [...form.items];
    items[i] = { ...items[i], [field]: val };
    setForm({ ...form, items });
  };

  const updateEditItem = (i, field, val) => {
    const items = [...editForm.items];
    items[i] = { ...items[i], [field]: val };
    setEditForm({ ...editForm, items });
  };

  const addSubItem = (i) => {
    const items = [...form.items];
    items[i] = { ...items[i], subItems: [...(items[i].subItems || []), { label: '', qty: '' }] };
    setForm({ ...form, items });
  };
  const removeSubItem = (i, j) => {
    const items = [...form.items];
    items[i] = { ...items[i], subItems: items[i].subItems.filter((_, k) => k !== j) };
    setForm({ ...form, items });
  };
  const updateSubItem = (i, j, field, val) => {
    const items = [...form.items];
    const subItems = [...(items[i].subItems || [])];
    subItems[j] = { ...subItems[j], [field]: val };
    items[i] = { ...items[i], subItems };
    setForm({ ...form, items });
  };

  const addEditSubItem = (i) => {
    const items = [...editForm.items];
    items[i] = { ...items[i], subItems: [...(items[i].subItems || []), { label: '', qty: '' }] };
    setEditForm({ ...editForm, items });
  };
  const removeEditSubItem = (i, j) => {
    const items = [...editForm.items];
    items[i] = { ...items[i], subItems: items[i].subItems.filter((_, k) => k !== j) };
    setEditForm({ ...editForm, items });
  };
  const updateEditSubItem = (i, j, field, val) => {
    const items = [...editForm.items];
    const subItems = [...(items[i].subItems || [])];
    subItems[j] = { ...subItems[j], [field]: val };
    items[i] = { ...items[i], subItems };
    setEditForm({ ...editForm, items });
  };

  const subtotal = form.items.reduce((s, i) => s + parseFloat(i.totalPrice || 0), 0);
  const gstAmount = (subtotal * parseFloat(form.gstPercent || 0)) / 100;
  const total = subtotal + gstAmount;

  const editSubtotal = editForm ? editForm.items.reduce((s, i) => s + parseFloat(i.totalPrice || 0), 0) : 0;
  const editGstAmount = editForm ? (editSubtotal * parseFloat(editForm.gstPercent || 0)) / 100 : 0;
  const editTotal = editSubtotal + editGstAmount;

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.clientName.trim()) return toast.error('Client name is required');
    if (!form.clientPhone.trim()) return toast.error('Phone number is required');
    if (user?.role === 'owner' && !form.workspaceId) return toast.error('Please select a workspace');
    const validItems = form.items.filter((i) => i.description?.trim());
    if (!validItems.length) return toast.error('At least one item with a description is required');
    setSaving(true);
    try {
      const { data } = await invoicesAPI.create({
        ...form,
        terms: JSON.stringify(form.terms.filter(t => t.trim())),
        items: validItems,
      });
      if (data.upgradeRequired) { setUpgradeModal(data); return; }
      toast.success('Invoice created');
      setShowCreate(false);
      setForm(emptyForm());
      load();
    } catch (err) {
      const d = err.response?.data;
      if (d?.upgradeRequired) { setUpgradeModal(d); return; }
      toast.error(d?.message || 'Failed to create invoice');
    } finally { setSaving(false); }
  };

  const openEdit = async (inv) => {
    try {
      const { data } = await invoicesAPI.get(inv.id);
      const invData = data.invoice;
      setEditForm({
        title: invData.title || '',
        clientName: invData.clientName || '',
        clientEmail: invData.clientEmail || '',
        clientPhone: invData.clientPhone || '',
        clientAddress: invData.clientAddress || '',
        clientGST: invData.clientGST || '',
        gstPercent: invData.gstPercent || 18,
        dueDate: invData.dueDate ? invData.dueDate.slice(0, 10) : '',
        terms: parseTermsArray(invData.terms),
        items: invData.items?.length
          ? invData.items.map((i) => ({ description: i.description, subDescription: i.subDescription || '', subItems: i.subItems || [], totalPrice: i.totalPrice }))
          : [emptyItem()],
      });
      setEditInvoice(inv);
    } catch {
      toast.error('Failed to load invoice details');
    }
  };

  const closeEdit = () => { setEditInvoice(null); setEditForm(null); };

  const handleEdit = async (e) => {
    e.preventDefault();
    const hasPayments = parseFloat(editInvoice.paidAmount) > 0;
    if (!hasPayments) {
      if (!editForm.clientName.trim()) return toast.error('Client name is required');
      if (!editForm.clientPhone.trim()) return toast.error('Phone number is required');
      const validItems = editForm.items.filter((i) => i.description?.trim());
      if (!validItems.length) return toast.error('At least one item with a description is required');
    }
    setSaving(true);
    try {
      const termsStr = JSON.stringify((editForm.terms || []).filter(t => t.trim()));
      const payload = hasPayments
        ? { title: editForm.title, terms: termsStr, dueDate: editForm.dueDate }
        : { ...editForm, terms: termsStr, items: editForm.items.filter((i) => i.description?.trim()) };
      await invoicesAPI.update(editInvoice.id, payload);
      toast.success('Invoice updated');
      closeEdit();
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update invoice');
    } finally { setSaving(false); }
  };

  const handlePDF = async (id, num) => {
    try {
      const { blob, filename } = await invoicesAPI.downloadPDF(id);
      downloadBlob(blob, filename || `${num}.pdf`);
    } catch (err) {
      const d = err.response?.data;
      if (d?.upgradeRequired) { setUpgradeModal(d); return; }
      toast.error('Failed to download PDF');
    }
  };

  const handleWhatsapp = async (inv) => {
    setSendingWhatsapp(inv.id);
    try {
      const { data } = await invoicesAPI.whatsappShare(inv.id);
      const API_URL = process.env.REACT_APP_API_URL || window.location.origin;
      const fileUrl = `${API_URL}/api/public/share/${data.fileName}`;
      const phone = data.phone.replace(/\D/g, '');
      const wa = phone.length === 10 ? `91${phone}` : phone;
      const msg = `Hi ${data.clientName}, your invoice ${data.number} for ${formatCurrency(data.totalAmount)} is ready.\n\nDownload it here: ${fileUrl}\n\nAmount due: ${formatCurrency(data.dueAmount)}`;
      window.open(`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`, '_blank');
    } catch (err) {
      const d = err.response?.data;
      if (d?.upgradeRequired) { setUpgradeModal(d); return; }
      toast.error('Failed to generate WhatsApp link');
    } finally {
      setSendingWhatsapp(null);
    }
  };

  const handleEmail = async (id) => {
    setSendingEmail(id);
    try {
      await invoicesAPI.sendEmail(id);
      toast.success('Invoice emailed to client!');
    } catch (err) {
      const d = err.response?.data;
      if (d?.upgradeRequired) { setUpgradeModal(d); return; }
      toast.error(d?.message || 'Failed to send email');
    } finally { setSendingEmail(null); }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await invoicesAPI.delete(deleteConfirm.id);
      toast.success('Invoice deleted');
      setDeleteConfirm(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete invoice');
    }
  };

  const handlePayment = async () => {
    if (!payForm.amount || !payForm.mode) return toast.error('Amount and mode required');
    if (payForm.mode !== 'Cash' && !payForm.reference?.trim()) return toast.error('Reference / UTR / Cheque Number is required for non-cash payments');
    setSaving(true);
    try {
      await paymentsAPI.add({ invoiceId: showPayment.id, ...payForm, amount: parseFloat(payForm.amount) });
      toast.success('Payment recorded!');
      setShowPayment(null);
      setPayForm({ amount: '', mode: 'UPI', reference: '', note: '' });
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to record payment'); }
    finally { setSaving(false); }
  };

  const STATUSES = ['', 'Unpaid', 'Partial', 'Paid', 'Overdue'];

  return (
    <Layout title="Invoices">
      <div className="page-header">
        <div className="page-title">Invoices</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text" placeholder="Search by number, client, phone, email..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', fontSize: 13, width: 270, outline: 'none' }}
          />
          <div className="invoice-status-bar">
            {STATUSES.map((s) => (
              <button key={s || 'all'} onClick={() => { setStatusFilter(s); setPage(1); }}
                style={{ padding: '6px 14px', borderRadius: 7, background: statusFilter === s ? '#f59e0b' : 'var(--card-bg)', border: `1px solid ${statusFilter === s ? '#f59e0b' : 'var(--border)'}`, color: statusFilter === s ? '#0d0d1a' : 'var(--text-muted)', fontSize: 12, cursor: 'pointer', fontWeight: statusFilter === s ? 700 : 400, transition: 'all 0.15s' }}>
                {s || 'All'}
              </button>
            ))}
          </div>
          <DateFilter onChange={({ dateFrom: df, dateTo: dt }) => { setDateFrom(df); setDateTo(dt); setPage(1); }} />
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ New Invoice</button>
        </div>
      </div>

      {loading ? <div className="loading-spinner"><div className="spinner" /></div> : invoices.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">🧾</div><div className="empty-title">No invoices</div></div>
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th>Invoice #</th><th>Client</th><th>Total</th><th>Paid</th><th>Due</th><th>Status</th>
                <th style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }} onClick={() => { setDueDateSort(s => s === '' ? 'asc' : s === 'asc' ? 'desc' : ''); setPage(1); }}>
                  Due Date <span style={{ fontSize: 10, opacity: dueDateSort ? 1 : 0.3 }}>{dueDateSort === 'desc' ? '↓' : '↑'}</span>
                </th>
                <th>Created By</th><th>Actions</th>
              </tr></thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td><span className="invoice-number">{inv.invoiceNumber}</span></td>
                    <td><div style={{ fontWeight: 500 }}>{inv.clientName}</div><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{inv.clientEmail}</div></td>
                    <td style={{ fontWeight: 600 }}>{formatCurrency(inv.totalAmount)}</td>
                    <td style={{ color: '#10b981', fontWeight: 600 }}>{formatCurrency(inv.paidAmount)}</td>
                    <td>
                      <div className="invoice-amount-due">{formatCurrency(inv.dueAmount)}</div>
                      <div className="pay-progress-bar"><div className="pay-progress-fill" style={{ width: `${Math.min(100, ((inv.paidAmount / inv.totalAmount) || 0) * 100)}%` }} /></div>
                    </td>
                    <td><span className={`quotation-badge inv-status-${inv.status?.toLowerCase()}`}>{inv.status}</span></td>
                    <td style={{ fontSize: 12, color: inv.status === 'Overdue' ? '#ef4444' : 'var(--text-muted)' }}>{inv.dueDate ? formatDate(inv.dueDate) : '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{inv.creator?.name || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(inv)}>✏️ Edit</button>
                        {inv.status !== 'Paid' && <button className="btn btn-success btn-sm" onClick={() => { setShowPayment(inv); setPayForm({ ...payForm, amount: inv.dueAmount }); }}>💰 Record Payment</button>}
                        {hasFeature('canUsePDF') && <button className="btn btn-ghost btn-sm" onClick={() => handlePDF(inv.id, inv.invoiceNumber)}>📄</button>}
                        {hasFeature('canUsePDF') && inv.clientEmail && (
                          <button className="btn btn-ghost btn-sm" onClick={() => handleEmail(inv.id)} disabled={sendingEmail === inv.id} title="Email invoice to client" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            {sendingEmail === inv.id ? '...' : (
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="2" y="4" width="20" height="16" rx="2"/>
                                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                              </svg>
                            )}
                          </button>
                        )}
                        {hasFeature('canUsePDF') && inv.clientPhone && (
                          <button className="btn btn-ghost btn-sm" onClick={() => handleWhatsapp(inv)} disabled={sendingWhatsapp === inv.id} title="Send via WhatsApp" style={{ color: '#25d366', display: 'inline-flex', alignItems: 'center' }}>
                            {sendingWhatsapp === inv.id ? '...' : (
                              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                              </svg>
                            )}
                          </button>
                        )}
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => setDeleteConfirm(inv)}>🗑️ Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination pagination={pagination} onPageChange={setPage} />
        </>
      )}

      {/* Create Invoice Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
            <h3>New Invoice</h3>
            <button className="modal-close" onClick={() => setShowCreate(false)}>×</button>
            <form onSubmit={handleCreate}>
              <div className="form-group"><label className="form-label">Document Title (for filename)</label><input className="form-control" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. SmartTech → SmartTech_INV-0001_19062026.pdf" /></div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Client Name *</label><input className="form-control" value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} placeholder="Client name..." /></div>
                <div className="form-group"><label className="form-label">Phone *</label><input className="form-control" value={form.clientPhone} onChange={(e) => setForm({ ...form, clientPhone: e.target.value })} placeholder="+91..." /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Email</label><input className="form-control" type="email" value={form.clientEmail} onChange={(e) => setForm({ ...form, clientEmail: e.target.value })} placeholder="client@email.com" /></div>
                <div className="form-group"><label className="form-label">GST Number</label><input className="form-control" value={form.clientGST} onChange={(e) => setForm({ ...form, clientGST: e.target.value })} placeholder="GSTIN..." /></div>
              </div>
              <div className="form-group"><label className="form-label">Address</label><input className="form-control" value={form.clientAddress} onChange={(e) => setForm({ ...form, clientAddress: e.target.value })} placeholder="Client address..." /></div>

              {user?.role === 'owner' && (
                <div className="form-group">
                  <label className="form-label">Workspace *</label>
                  <select className="form-control" value={form.workspaceId} onChange={(e) => setForm({ ...form, workspaceId: e.target.value })} required>
                    <option value="">— Select Workspace —</option>
                    {workspaces.map(ws => <option key={ws.id} value={ws.id}>{ws.name}</option>)}
                  </select>
                </div>
              )}

              <div style={{ margin: '16px 0 8px', fontWeight: 600, fontSize: 13 }}>Line Items</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
                <thead>
                  <tr style={{ background: 'var(--card-bg)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '8px 6px', textAlign: 'left', fontSize: 12, fontWeight: 600 }}>Service</th>
                    <th style={{ padding: '8px 6px', textAlign: 'left', fontSize: 12, fontWeight: 600, width: 200 }}>Deliverables</th>
                    <th style={{ padding: '8px 6px', textAlign: 'right', fontSize: 12, fontWeight: 600, width: 120 }}>Package Price</th>
                    <th style={{ width: 32 }} />
                  </tr>
                </thead>
                <tbody>
                  {form.items.map((item, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>
                      <td style={{ padding: '6px 4px' }}>
                        <input className="form-control" style={{ margin: 0 }} value={item.description} onChange={(e) => updateItem(i, 'description', e.target.value)} placeholder="Item / service name" />
                        <textarea className="form-control" value={item.subDescription} onChange={(e) => updateItem(i, 'subDescription', e.target.value)} placeholder="Description / what's included" rows={2} style={{ marginTop: 4, fontSize: 12, resize: 'vertical' }} />
                      </td>
                      <td style={{ padding: '6px 4px' }}>
                        {(item.subItems || []).map((si, j) => (
                          <div key={j} style={{ display: 'flex', gap: 4, marginBottom: 4, alignItems: 'center' }}>
                            <input value={si.label} onChange={(e) => updateSubItem(i, j, 'label', e.target.value)} placeholder="Item name" style={{ flex: 1, background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', color: 'var(--text)', fontSize: 12, outline: 'none' }} />
                            <input type="number" min="0" value={si.qty} onChange={(e) => updateSubItem(i, j, 'qty', e.target.value)} placeholder="0" style={{ width: 90, background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 6px', color: 'var(--text)', fontSize: 12, outline: 'none', textAlign: 'center' }} />
                            <button type="button" onClick={() => removeSubItem(i, j)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 15, padding: '0 2px', lineHeight: 1 }}>×</button>
                          </div>
                        ))}
                        <button type="button" onClick={() => addSubItem(i)} style={{ background: 'none', border: '1px dashed var(--border)', borderRadius: 6, color: 'var(--text-muted)', fontSize: 11, padding: '3px 8px', cursor: 'pointer', marginTop: 2 }}>+ Add Deliverable</button>
                      </td>
                      <td style={{ padding: '6px 4px' }}><input className="form-control" style={{ margin: 0, textAlign: 'right' }} type="number" min="0" step="0.01" value={item.totalPrice} onChange={(e) => updateItem(i, 'totalPrice', e.target.value)} placeholder="0" /></td>
                      <td style={{ padding: '6px 2px' }}>
                        {form.items.length > 1 && <button type="button" style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 16, padding: '0 4px' }} onClick={() => setForm({ ...form, items: form.items.filter((_, j) => j !== i) })}>×</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm({ ...form, items: [...form.items, emptyItem()] })}>+ Add Item</button>

              <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '16px 0' }}>
                <div style={{ minWidth: 280, background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span>Subtotal</span><strong>{formatCurrency(subtotal)}</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, alignItems: 'center', gap: 8 }}>
                    <span>GST</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input type="number" min="0" max="100" step="0.01" value={form.gstPercent} onChange={(e) => setForm({ ...form, gstPercent: e.target.value })} style={{ width: 55, textAlign: 'right', padding: '2px 6px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--input-bg)', color: 'var(--text)', fontSize: 12 }} />
                      <span>%</span>
                      <strong>{formatCurrency(gstAmount)}</strong>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 15, borderTop: '1px solid var(--border)', paddingTop: 8 }}><span>Total</span><span style={{ color: '#f59e0b' }}>{formatCurrency(total)}</span></div>
                </div>
              </div>

              <div className="form-group"><label className="form-label">Due Date <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 12 }}>(Optional)</span></label><input className="form-control" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>
              <div className="form-group">
                <label className="form-label">Terms & Conditions</label>
                {(form.terms || []).map((term, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                    <input className="form-control" style={{ margin: 0 }} value={term} onChange={(e) => { const t = [...form.terms]; t[i] = e.target.value; setForm({ ...form, terms: t }); }} placeholder={`Term ${i + 1}`} />
                    <button type="button" onClick={() => setForm({ ...form, terms: form.terms.filter((_, j) => j !== i) })} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 18, flexShrink: 0 }}>×</button>
                  </div>
                ))}
                <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 2 }} onClick={() => setForm({ ...form, terms: [...(form.terms || []), ''] })}>+ Add Term</button>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => { setShowCreate(false); setForm(emptyForm()); }}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creating...' : 'Create Invoice'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Invoice Modal */}
      {editInvoice && editForm && (() => {
        const hasPayments = parseFloat(editInvoice.paidAmount) > 0;
        return (
          <div className="modal-overlay" onClick={closeEdit}>
            <div className="modal" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
              <h3>Edit Invoice — {editInvoice.invoiceNumber}</h3>
              <button className="modal-close" onClick={closeEdit}>×</button>

              {hasPayments && (
                <div style={{ marginBottom: 16, padding: '12px 16px', background: 'rgba(239,68,68,0.08)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)', fontSize: 13, color: '#ef4444' }}>
                  <strong>Payment recorded on this invoice.</strong> Items and amounts are locked. You can only update terms and due date.
                </div>
              )}

              <form onSubmit={handleEdit}>
                <div className="form-group"><label className="form-label">Document Title (for filename)</label><input className="form-control" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} placeholder="e.g. SmartTech → SmartTech_INV-0001_19062026.pdf" /></div>
                {!hasPayments && (
                  <>
                    <div className="form-row">
                      <div className="form-group"><label className="form-label">Client Name *</label><input className="form-control" value={editForm.clientName} onChange={(e) => setEditForm({ ...editForm, clientName: e.target.value })} /></div>
                      <div className="form-group"><label className="form-label">Phone *</label><input className="form-control" value={editForm.clientPhone} onChange={(e) => setEditForm({ ...editForm, clientPhone: e.target.value })} /></div>
                    </div>
                    <div className="form-row">
                      <div className="form-group"><label className="form-label">Email</label><input className="form-control" type="email" value={editForm.clientEmail} onChange={(e) => setEditForm({ ...editForm, clientEmail: e.target.value })} /></div>
                      <div className="form-group"><label className="form-label">GST Number</label><input className="form-control" value={editForm.clientGST} onChange={(e) => setEditForm({ ...editForm, clientGST: e.target.value })} /></div>
                    </div>
                    <div className="form-group"><label className="form-label">Address</label><input className="form-control" value={editForm.clientAddress} onChange={(e) => setEditForm({ ...editForm, clientAddress: e.target.value })} /></div>

                    <div style={{ margin: '16px 0 8px', fontWeight: 600, fontSize: 13 }}>Line Items</div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
                      <thead>
                        <tr style={{ background: 'var(--card-bg)', borderBottom: '1px solid var(--border)' }}>
                          <th style={{ padding: '8px 6px', textAlign: 'left', fontSize: 12, fontWeight: 600 }}>Service</th>
                          <th style={{ padding: '8px 6px', textAlign: 'left', fontSize: 12, fontWeight: 600, width: 200 }}>Deliverables</th>
                          <th style={{ padding: '8px 6px', textAlign: 'right', fontSize: 12, fontWeight: 600, width: 120 }}>Package Price</th>
                          <th style={{ width: 32 }} />
                        </tr>
                      </thead>
                      <tbody>
                        {editForm.items.map((item, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>
                            <td style={{ padding: '6px 4px' }}>
                              <input className="form-control" style={{ margin: 0 }} value={item.description} onChange={(e) => updateEditItem(i, 'description', e.target.value)} placeholder="Item / service name" />
                              <textarea className="form-control" value={item.subDescription} onChange={(e) => updateEditItem(i, 'subDescription', e.target.value)} placeholder="Description / what's included" rows={2} style={{ marginTop: 4, fontSize: 12, resize: 'vertical' }} />
                            </td>
                            <td style={{ padding: '6px 4px' }}>
                              {(item.subItems || []).map((si, j) => (
                                <div key={j} style={{ display: 'flex', gap: 4, marginBottom: 4, alignItems: 'center' }}>
                                  <input value={si.label} onChange={(e) => updateEditSubItem(i, j, 'label', e.target.value)} placeholder="Item name" style={{ flex: 1, background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', color: 'var(--text)', fontSize: 12, outline: 'none' }} />
                                  <input type="number" min="0" value={si.qty} onChange={(e) => updateEditSubItem(i, j, 'qty', e.target.value)} placeholder="0" style={{ width: 90, background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 6px', color: 'var(--text)', fontSize: 12, outline: 'none', textAlign: 'center' }} />
                                  <button type="button" onClick={() => removeEditSubItem(i, j)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 15, padding: '0 2px', lineHeight: 1 }}>×</button>
                                </div>
                              ))}
                              <button type="button" onClick={() => addEditSubItem(i)} style={{ background: 'none', border: '1px dashed var(--border)', borderRadius: 6, color: 'var(--text-muted)', fontSize: 11, padding: '3px 8px', cursor: 'pointer', marginTop: 2 }}>+ Add Deliverable</button>
                            </td>
                            <td style={{ padding: '6px 4px' }}><input className="form-control" style={{ margin: 0, textAlign: 'right' }} type="number" min="0" step="0.01" value={item.totalPrice} onChange={(e) => updateEditItem(i, 'totalPrice', e.target.value)} placeholder="0" /></td>
                            <td style={{ padding: '6px 2px' }}>
                              {editForm.items.length > 1 && <button type="button" style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 16, padding: '0 4px' }} onClick={() => setEditForm({ ...editForm, items: editForm.items.filter((_, j) => j !== i) })}>×</button>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditForm({ ...editForm, items: [...editForm.items, emptyItem()] })}>+ Add Item</button>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '16px 0' }}>
                      <div style={{ minWidth: 260, background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', fontSize: 13 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span>Subtotal</span><strong>{formatCurrency(editSubtotal)}</strong></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, alignItems: 'center', gap: 8 }}>
                          <span>GST</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <input type="number" min="0" max="100" step="0.01" value={editForm.gstPercent} onChange={(e) => setEditForm({ ...editForm, gstPercent: e.target.value })} style={{ width: 55, textAlign: 'right', padding: '2px 6px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--input-bg)', color: 'var(--text)', fontSize: 12 }} />
                            <span>%</span>
                            <strong>{formatCurrency(editGstAmount)}</strong>
                          </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 15, borderTop: '1px solid var(--border)', paddingTop: 8 }}><span>Total</span><span style={{ color: '#f59e0b' }}>{formatCurrency(editTotal)}</span></div>
                      </div>
                    </div>
                  </>
                )}

                <div className="form-group"><label className="form-label">Due Date</label><input className="form-control" type="date" value={editForm.dueDate} onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })} /></div>
                <div className="form-group">
                  <label className="form-label">Terms & Conditions</label>
                  {(editForm.terms || []).map((term, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                      <input className="form-control" style={{ margin: 0 }} value={term} onChange={(e) => { const t = [...editForm.terms]; t[i] = e.target.value; setEditForm({ ...editForm, terms: t }); }} placeholder={`Term ${i + 1}`} />
                      <button type="button" onClick={() => setEditForm({ ...editForm, terms: editForm.terms.filter((_, j) => j !== i) })} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 18, flexShrink: 0 }}>×</button>
                    </div>
                  ))}
                  <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 2 }} onClick={() => setEditForm({ ...editForm, terms: [...(editForm.terms || []), ''] })}>+ Add Term</button>
                </div>

                <div className="modal-actions">
                  <button type="button" className="btn btn-ghost" onClick={closeEdit}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Record Payment Modal */}
      {showPayment && (
        <div className="modal-overlay" onClick={() => setShowPayment(null)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <h3>Record Payment</h3>
            <button className="modal-close" onClick={() => setShowPayment(null)}>×</button>
            <div style={{ marginBottom: 16, padding: '12px 16px', background: 'rgba(245,158,11,0.08)', borderRadius: 8, border: '1px solid rgba(245,158,11,0.2)' }}>
              <div style={{ fontSize: 13 }}>Invoice: <strong style={{ color: '#f59e0b' }}>{showPayment.invoiceNumber}</strong></div>
              <div style={{ fontSize: 13 }}>Client: {showPayment.clientName}</div>
              <div style={{ fontSize: 13, color: '#f59e0b', fontWeight: 700, marginTop: 4 }}>Balance Due: {formatCurrency(showPayment.dueAmount)}</div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Amount *</label><input className="form-control" type="number" step="0.01" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Mode *</label><select className="form-control" value={payForm.mode} onChange={(e) => setPayForm({ ...payForm, mode: e.target.value })}>{ENUMS.PAYMENT_MODES.map((m) => <option key={m}>{m}</option>)}</select></div>
            </div>
            {payForm.mode !== 'Cash' && (
              <div className="form-group"><label className="form-label">Reference / UTR / Cheque Number *</label><input className="form-control" required value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} placeholder="Transaction ID, UTR or cheque number..." /></div>
            )}
            <div className="form-group"><label className="form-label">Note</label><input className="form-control" value={payForm.note} onChange={(e) => setPayForm({ ...payForm, note: e.target.value })} /></div>
            <div className="modal-actions"><button className="btn btn-ghost" onClick={() => setShowPayment(null)}>Cancel</button><button className="btn btn-success" onClick={handlePayment} disabled={saving}>{saving ? 'Saving...' : 'Record Payment'}</button></div>
          </div>
        </div>
      )}

      {upgradeModal && <UpgradeModal message={upgradeModal.message} limitType={upgradeModal.limitType} plan={org?.plan} onClose={() => setUpgradeModal(null)} />}

      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Delete Invoice</h3>
            <p>Are you sure you want to delete <strong>{deleteConfirm.invoiceNumber}</strong> for <strong>{deleteConfirm.clientName}</strong>? This cannot be undone.</p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Invoices;
