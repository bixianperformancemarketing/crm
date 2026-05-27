import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import Layout from '../components/layout/Layout';
import Pagination from '../components/common/Pagination';
import UpgradeModal from '../components/common/UpgradeModal';
import { quotationsAPI } from '../services/api';
import { formatCurrency, formatDate, getStatusColor, downloadBlob } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';
import './Quotations.css';

const emptyItem = () => ({ description: '', quantity: 1, unitPrice: 0, totalPrice: 0 });

const Quotations = () => {
  const { user, org, hasFeature } = useAuth();
  const [quotations, setQuotations] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [upgradeModal, setUpgradeModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(null);
  const [form, setForm] = useState({ clientName: '', clientEmail: '', clientPhone: '', clientAddress: '', clientGST: '', gstPercent: 18, terms: '', notes: '', validUntil: '', items: [emptyItem()] });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await quotationsAPI.getAll({ page });
      setQuotations(data.data || []);
      setPagination(data.pagination);
    } catch { toast.error('Failed to load quotations'); }
    finally { setLoading(false); }
  }, [page]);

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
    if (!form.clientEmail.trim()) return toast.error('Email is required');
    if (!form.clientAddress.trim()) return toast.error('Address is required');
    setSaving(true);
    try {
      const { data } = await quotationsAPI.create({ ...form, items: form.items.filter((i) => i.description) });
      if (data.upgradeRequired) { setUpgradeModal(data); return; }
      toast.success('Quotation created');
      setShowCreate(false);
      setForm({ clientName: '', clientEmail: '', clientPhone: '', clientAddress: '', clientGST: '', gstPercent: 18, terms: '', notes: '', validUntil: '', items: [emptyItem()] });
      load();
    } catch (err) {
      const d = err.response?.data;
      if (d?.upgradeRequired) { setUpgradeModal(d); return; }
      toast.error(d?.message || 'Failed to create');
    } finally { setSaving(false); }
  };

  const handleStatus = async (id, status) => {
    try {
      await quotationsAPI.updateStatus(id, { status });
      toast.success(`Status updated to ${status}`);
      load();
    } catch { toast.error('Failed to update status'); }
  };

  const handlePDF = async (id, num) => {
    try {
      const { data } = await quotationsAPI.downloadPDF(id);
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
      await quotationsAPI.sendEmail(id);
      toast.success('Email sent!');
      load();
    } catch (err) {
      const d = err.response?.data;
      if (d?.upgradeRequired) { setUpgradeModal(d); return; }
      toast.error('Failed to send email');
    } finally {
      setSendingEmail(null);
    }
  };

  return (
    <Layout title="Quotations">
      <div className="page-header">
        <div className="page-title">Quotations</div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ New Quotation</button>
      </div>

      {loading ? <div className="loading-spinner"><div className="spinner" /></div> : quotations.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">📋</div><div className="empty-title">No quotations</div></div>
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Number</th><th>Client</th><th>Amount</th><th>Status</th><th>Valid Until</th><th>Actions</th></tr></thead>
              <tbody>
                {quotations.map((q) => (
                  <tr key={q.id}>
                    <td><span className="quotation-number">{q.quotationNumber}</span></td>
                    <td><div style={{ fontWeight: 500 }}>{q.clientName}</div><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{q.clientEmail}</div></td>
                    <td style={{ fontWeight: 700, color: '#f59e0b' }}>{formatCurrency(q.totalAmount)}</td>
                    <td><span className={`quotation-badge q-status-${q.status?.toLowerCase().replace(/\s+/g, '-')}`}>{q.status}</span></td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{q.validUntil ? formatDate(q.validUntil) : '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {q.status === 'Draft' && <button className="btn btn-ghost btn-sm" onClick={() => handleStatus(q.id, 'Sent')}>Mark as Sent</button>}
                        {q.status === 'Sent' && <button className="btn btn-success btn-sm" onClick={() => handleStatus(q.id, 'Approved')}>Client Accepted</button>}
                        {q.status === 'Sent' && <button className="btn btn-ghost btn-sm" onClick={() => handleStatus(q.id, 'Rejected')}>Client Declined</button>}
                        {q.status === 'Sent' && <button className="btn btn-ghost btn-sm" style={{ color: '#a78bfa' }} onClick={() => handleStatus(q.id, 'Not Responding')}>Not Responding</button>}
                        {hasFeature('canUsePDF') && <button className="btn btn-ghost btn-sm" onClick={() => handlePDF(q.id, q.quotationNumber)}>📄 PDF</button>}
                        {hasFeature('canUsePDF') && q.clientEmail && <button className="btn btn-ghost btn-sm" onClick={() => handleEmail(q.id)} disabled={sendingEmail === q.id} title="Email quotation to client">{sendingEmail === q.id ? '...' : '✉️'}</button>}
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

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" style={{ maxWidth: 700 }} onClick={(e) => e.stopPropagation()}>
            <h3>New Quotation</h3>
            <button className="modal-close" onClick={() => setShowCreate(false)}>×</button>
            <form onSubmit={handleCreate}>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Client Name *</label><input className="form-control" value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">Client Email *</label><input className="form-control" type="email" value={form.clientEmail} onChange={(e) => setForm({ ...form, clientEmail: e.target.value })} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Phone *</label><input className="form-control" value={form.clientPhone} onChange={(e) => setForm({ ...form, clientPhone: e.target.value.replace(/[^0-9+]/g, '') })} placeholder="+91 9876543210" /></div>
                <div className="form-group"><label className="form-label">GST</label><input className="form-control" value={form.clientGST} onChange={(e) => setForm({ ...form, clientGST: e.target.value })} /></div>
              </div>
              <div className="form-group"><label className="form-label">Address *</label><textarea className="form-control" rows={2} value={form.clientAddress} onChange={(e) => setForm({ ...form, clientAddress: e.target.value })} /></div>

              <h4 style={{ margin: '16px 0 10px', fontSize: 13, color: 'var(--text-muted)' }}>Line Items</h4>
              <table className="items-table">
                <thead><tr><th>Description</th><th style={{ width: 110 }}>Qty</th><th style={{ width: 130 }}>Unit Price</th><th style={{ width: 130 }}>Total</th><th style={{ width: 40 }}></th></tr></thead>
                <tbody>
                  {form.items.map((item, i) => (
                    <tr key={i}>
                      <td><input value={item.description} onChange={(e) => updateItem(i, 'description', e.target.value)} placeholder="Service description" /></td>
                      <td><input type="number" min="0" step="0.01" value={item.quantity} onChange={(e) => updateItem(i, 'quantity', e.target.value)} /></td>
                      <td><input type="number" min="0" step="0.01" value={item.unitPrice} onChange={(e) => updateItem(i, 'unitPrice', e.target.value)} /></td>
                      <td style={{ color: '#f59e0b', fontWeight: 600 }}>₹{parseFloat(item.totalPrice || 0).toLocaleString('en-IN')}</td>
                      <td><button type="button" style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 16 }} onClick={() => setForm({ ...form, items: form.items.filter((_, j) => j !== i) })}>×</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => setForm({ ...form, items: [...form.items, emptyItem()] })}>+ Add Item</button>

              <div className="totals-box">
                <div className="total-row"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                <div className="total-row"><span>GST <input type="number" value={form.gstPercent} onChange={(e) => setForm({ ...form, gstPercent: e.target.value })} style={{ width: 50, background: 'transparent', border: '1px solid #2a2a4a', color: 'var(--text)', borderRadius: 4, padding: '2px 4px', fontSize: 12 }} />%</span><span>{formatCurrency(gstAmount)}</span></div>
                <div className="total-row grand"><span>Total</span><span>{formatCurrency(total)}</span></div>
              </div>

              <div className="form-row" style={{ marginTop: 16 }}>
                <div className="form-group"><label className="form-label">Valid Until</label><input className="form-control" type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">Terms</label><input className="form-control" value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value })} /></div>
              </div>
              <div className="form-group"><label className="form-label">Notes</label><textarea className="form-control" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              <div className="modal-actions"><button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button><button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creating...' : 'Create Quotation'}</button></div>
            </form>
          </div>
        </div>
      )}

      {upgradeModal && <UpgradeModal message={upgradeModal.message} limitType={upgradeModal.limitType} plan={org?.plan} onClose={() => setUpgradeModal(null)} />}
    </Layout>
  );
};

export default Quotations;
