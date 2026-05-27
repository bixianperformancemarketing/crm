import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import Layout from '../components/layout/Layout';
import Pagination from '../components/common/Pagination';
import UpgradeModal from '../components/common/UpgradeModal';
import { invoicesAPI, paymentsAPI } from '../services/api';
import { formatCurrency, formatDate, getStatusColor, downloadBlob } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';
import { ENUMS } from '../utils/helpers';
import './Invoices.css';

const emptyItem = () => ({ description: '', quantity: 1, unitPrice: 0, totalPrice: 0 });
const emptyForm = () => ({ clientName: '', clientEmail: '', clientPhone: '', clientAddress: '', clientGST: '', gstPercent: 18, terms: '', notes: '', dueDate: '', items: [emptyItem()] });

const Invoices = () => {
  const { hasFeature, org } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [upgradeModal, setUpgradeModal] = useState(null);
  const [showPayment, setShowPayment] = useState(null);
  const [payForm, setPayForm] = useState({ amount: '', mode: 'UPI', reference: '', note: '' });
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [sendingEmail, setSendingEmail] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page };
      if (statusFilter) params.status = statusFilter;
      const { data } = await invoicesAPI.getAll(params);
      setInvoices(data.data || []);
      setPagination(data.pagination);
    } catch { toast.error('Failed to load invoices'); }
    finally { setLoading(false); }
  }, [page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const updateItem = (i, field, val) => {
    const items = [...form.items];
    items[i] = { ...items[i], [field]: val };
    if (field === 'quantity' || field === 'unitPrice') {
      items[i].totalPrice = parseFloat(items[i].quantity || 0) * parseFloat(items[i].unitPrice || 0);
    }
    setForm({ ...form, items });
  };

  const subtotal = form.items.reduce((s, i) => s + parseFloat(i.totalPrice || 0), 0);
  const gstAmount = (subtotal * parseFloat(form.gstPercent || 0)) / 100;
  const total = subtotal + gstAmount;

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.clientName.trim()) return toast.error('Client name is required');
    if (!form.clientPhone.trim()) return toast.error('Phone number is required');
    const validItems = form.items.filter((i) => i.description?.trim());
    if (!validItems.length) return toast.error('At least one item with a description is required');
    setSaving(true);
    try {
      const { data } = await invoicesAPI.create({ ...form, items: validItems });
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

  const handlePDF = async (id, num) => {
    try {
      const { data } = await invoicesAPI.downloadPDF(id);
      downloadBlob(data, `${num}.pdf`);
    } catch (err) {
      const d = err.response?.data;
      if (d?.upgradeRequired) { setUpgradeModal(d); return; }
      toast.error('Failed to download PDF');
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

  const handlePayment = async () => {
    if (!payForm.amount || !payForm.mode) return toast.error('Amount and mode required');
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
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div className="invoice-status-bar">
            {STATUSES.map((s) => (
              <button key={s || 'all'} onClick={() => { setStatusFilter(s); setPage(1); }}
                style={{ padding: '6px 14px', borderRadius: 7, background: statusFilter === s ? '#f59e0b' : 'var(--card-bg)', border: `1px solid ${statusFilter === s ? '#f59e0b' : 'var(--border)'}`, color: statusFilter === s ? '#0d0d1a' : 'var(--text-muted)', fontSize: 12, cursor: 'pointer', fontWeight: statusFilter === s ? 700 : 400, transition: 'all 0.15s' }}>
                {s || 'All'}
              </button>
            ))}
          </div>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ New Invoice</button>
        </div>
      </div>

      {loading ? <div className="loading-spinner"><div className="spinner" /></div> : invoices.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">🧾</div><div className="empty-title">No invoices</div></div>
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Invoice #</th><th>Client</th><th>Total</th><th>Paid</th><th>Due</th><th>Status</th><th>Due Date</th><th>Actions</th></tr></thead>
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
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {inv.status !== 'Paid' && <button className="btn btn-success btn-sm" onClick={() => { setShowPayment(inv); setPayForm({ ...payForm, amount: inv.dueAmount }); }}>💰 Record Payment</button>}
                        {hasFeature('canUsePDF') && <button className="btn btn-ghost btn-sm" onClick={() => handlePDF(inv.id, inv.invoiceNumber)}>📄</button>}
                        {hasFeature('canUsePDF') && inv.clientEmail && (
                          <button className="btn btn-ghost btn-sm" onClick={() => handleEmail(inv.id)} disabled={sendingEmail === inv.id} title="Email invoice to client">
                            {sendingEmail === inv.id ? '...' : '✉️'}
                          </button>
                        )}
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
              <div className="form-row">
                <div className="form-group"><label className="form-label">Client Name *</label><input className="form-control" value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} placeholder="Client name..." /></div>
                <div className="form-group"><label className="form-label">Phone *</label><input className="form-control" value={form.clientPhone} onChange={(e) => setForm({ ...form, clientPhone: e.target.value })} placeholder="+91..." /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Email</label><input className="form-control" type="email" value={form.clientEmail} onChange={(e) => setForm({ ...form, clientEmail: e.target.value })} placeholder="client@email.com" /></div>
                <div className="form-group"><label className="form-label">GST Number</label><input className="form-control" value={form.clientGST} onChange={(e) => setForm({ ...form, clientGST: e.target.value })} placeholder="GSTIN..." /></div>
              </div>
              <div className="form-group"><label className="form-label">Address</label><input className="form-control" value={form.clientAddress} onChange={(e) => setForm({ ...form, clientAddress: e.target.value })} placeholder="Client address..." /></div>

              {/* Line Items */}
              <div style={{ margin: '16px 0 8px', fontWeight: 600, fontSize: 13 }}>Line Items</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
                <thead>
                  <tr style={{ background: 'var(--card-bg)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '8px 6px', textAlign: 'left', fontSize: 12, fontWeight: 600 }}>Description</th>
                    <th style={{ padding: '8px 6px', textAlign: 'right', fontSize: 12, fontWeight: 600, width: 70 }}>Qty</th>
                    <th style={{ padding: '8px 6px', textAlign: 'right', fontSize: 12, fontWeight: 600, width: 110 }}>Unit Price</th>
                    <th style={{ padding: '8px 6px', textAlign: 'right', fontSize: 12, fontWeight: 600, width: 110 }}>Total</th>
                    <th style={{ width: 32 }} />
                  </tr>
                </thead>
                <tbody>
                  {form.items.map((item, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '4px 4px' }}><input className="form-control" style={{ margin: 0 }} value={item.description} onChange={(e) => updateItem(i, 'description', e.target.value)} placeholder="Service / item description..." /></td>
                      <td style={{ padding: '4px 4px' }}><input className="form-control" style={{ margin: 0, textAlign: 'right' }} type="number" min="1" value={item.quantity} onChange={(e) => updateItem(i, 'quantity', e.target.value)} /></td>
                      <td style={{ padding: '4px 4px' }}><input className="form-control" style={{ margin: 0, textAlign: 'right' }} type="number" min="0" step="0.01" value={item.unitPrice} onChange={(e) => updateItem(i, 'unitPrice', e.target.value)} /></td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', fontSize: 13, fontWeight: 500 }}>{formatCurrency(item.totalPrice || 0)}</td>
                      <td style={{ padding: '4px 2px' }}>
                        {form.items.length > 1 && <button type="button" style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 16, padding: '0 4px' }} onClick={() => setForm({ ...form, items: form.items.filter((_, j) => j !== i) })}>×</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm({ ...form, items: [...form.items, emptyItem()] })}>+ Add Item</button>

              {/* Totals */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '16px 0' }}>
                <div style={{ minWidth: 260, background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', fontSize: 13 }}>
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

              <div className="form-row">
                <div className="form-group"><label className="form-label">Due Date</label><input className="form-control" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">Terms</label><input className="form-control" value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value })} placeholder="Payment terms..." /></div>
              </div>
              <div className="form-group"><label className="form-label">Notes</label><input className="form-control" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Internal notes..." /></div>

              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => { setShowCreate(false); setForm(emptyForm()); }}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creating...' : 'Create Invoice'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

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
            <div className="form-group"><label className="form-label">Reference / UTR</label><input className="form-control" value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} placeholder="Transaction reference..." /></div>
            <div className="form-group"><label className="form-label">Note</label><input className="form-control" value={payForm.note} onChange={(e) => setPayForm({ ...payForm, note: e.target.value })} /></div>
            <div className="modal-actions"><button className="btn btn-ghost" onClick={() => setShowPayment(null)}>Cancel</button><button className="btn btn-success" onClick={handlePayment} disabled={saving}>{saving ? 'Saving...' : 'Record Payment'}</button></div>
          </div>
        </div>
      )}

      {upgradeModal && <UpgradeModal message={upgradeModal.message} limitType={upgradeModal.limitType} plan={org?.plan} onClose={() => setUpgradeModal(null)} />}
    </Layout>
  );
};

export default Invoices;
