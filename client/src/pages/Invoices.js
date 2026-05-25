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

  const handlePayment = async () => {
    if (!payForm.amount || !payForm.mode) return toast.error('Amount and mode required');
    setSaving(true);
    try {
      await paymentsAPI.add({ invoiceId: showPayment.id, ...payForm, amount: parseFloat(payForm.amount) });
      toast.success('Payment recorded!');
      setShowPayment(null);
      setPayForm({ amount: '', mode: 'UPI', reference: '', note: '' });
      load();
    } catch { toast.error('Failed to record payment'); }
    finally { setSaving(false); }
  };

  const STATUSES = ['', 'Unpaid', 'Partial', 'Paid', 'Overdue'];

  return (
    <Layout title="Invoices">
      <div className="page-header">
        <div className="page-title">Invoices</div>
        <div className="invoice-status-bar">
          {STATUSES.map((s) => (
            <button key={s || 'all'} onClick={() => { setStatusFilter(s); setPage(1); }}
              style={{ padding: '6px 14px', borderRadius: 7, background: statusFilter === s ? '#f59e0b' : 'var(--card-bg)', border: `1px solid ${statusFilter === s ? '#f59e0b' : 'var(--border)'}`, color: statusFilter === s ? '#0d0d1a' : 'var(--text-muted)', fontSize: 12, cursor: 'pointer', fontWeight: statusFilter === s ? 700 : 400, transition: 'all 0.15s' }}>
              {s || 'All'}
            </button>
          ))}
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
