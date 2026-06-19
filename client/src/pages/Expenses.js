import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import Layout from '../components/layout/Layout';
import { expensesAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const PAYMENT_MODES = ['UPI', 'Bank Transfer', 'Cash', 'Cheque', 'Online'];

const getSavedCategories = () => {
  try { return JSON.parse(localStorage.getItem('expenseCategories') || '[]'); } catch { return []; }
};
const saveCategory = (cat) => {
  if (!cat?.trim()) return;
  const existing = getSavedCategories();
  if (!existing.includes(cat.trim())) {
    localStorage.setItem('expenseCategories', JSON.stringify([cat.trim(), ...existing].slice(0, 20)));
  }
};

const STATUS_COLORS = {
  Pending: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: 'rgba(245,158,11,0.3)' },
  Approved: { bg: 'rgba(34,197,94,0.12)', color: '#22c55e', border: 'rgba(34,197,94,0.3)' },
  Rejected: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444', border: 'rgba(239,68,68,0.3)' },
};


const fmt = (n) => `₹${parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const emptyForm = { title: '', category: '', amount: '', expenseDate: new Date().toISOString().slice(0, 10), billReference: '', paymentMode: '', notes: '' };

const Expenses = () => {
  const { user, isRole } = useAuth();
  const isEmployee = isRole('employee');
  const canApprove = isRole('admin') || isRole('owner');

  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [savedCategories, setSavedCategories] = useState(getSavedCategories);
  const [editId, setEditId] = useState(null);
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [summary, setSummary] = useState({ total: 0, byCategory: {} });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterStatus) params.status = filterStatus;
      if (filterCategory) params.category = filterCategory;
      const [expRes, sumRes] = await Promise.all([
        expensesAPI.getAll(params),
        expensesAPI.getSummary(),
      ]);
      setExpenses(expRes.data.expenses || []);
      setSummary(sumRes.data);
    } catch { toast.error('Failed to load expenses'); }
    finally { setLoading(false); }
  }, [filterStatus, filterCategory]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setEditId(null); setForm(emptyForm); setShowForm(true); };

  const openEdit = (exp) => {
    setEditId(exp.id);
    setForm({
      title: exp.title,
      category: exp.category,
      amount: exp.amount,
      expenseDate: exp.expenseDate,
      billReference: exp.billReference || '',
      paymentMode: exp.paymentMode,
      notes: exp.notes || '',
    });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.amount || !form.expenseDate || !form.paymentMode || !form.billReference.trim()) {
      return toast.error('Title, amount, date, payment mode, and bill/cheque/receipt reference are required');
    }
    setSaving(true);
    try {
      saveCategory(form.category);
      setSavedCategories(getSavedCategories());
      if (editId) {
        await expensesAPI.update(editId, form);
        toast.success('Expense updated');
      } else {
        await expensesAPI.create(form);
        toast.success('Expense submitted for approval');
      }
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save expense');
    } finally { setSaving(false); }
  };

  const handleApprove = async (id) => {
    try {
      await expensesAPI.approve(id);
      toast.success('Expense approved');
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to approve'); }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    try {
      await expensesAPI.reject(rejectModal, rejectReason);
      toast.success('Expense rejected');
      setRejectModal(null);
      setRejectReason('');
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to reject'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this expense?')) return;
    try {
      await expensesAPI.delete(id);
      toast.success('Expense deleted');
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to delete'); }
  };

  const pendingCount = expenses.filter(e => e.status === 'Pending').length;
  const approvedTotal = summary.total || 0;

  return (
    <Layout title="Expenses">
      <div className="page-header">
        <div className="page-title">Expenses</div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Expense</button>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 24 }}>
        <div style={{ padding: '16px 20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Total Approved</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#ef4444' }}>{fmt(approvedTotal)}</div>
        </div>
        {canApprove && (
          <div style={{ padding: '16px 20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Pending Approval</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#f59e0b' }}>{pendingCount}</div>
          </div>
        )}
        {Object.entries(summary.byCategory || {}).slice(0, 3).map(([cat, total]) => (
          <div key={cat} style={{ padding: '16px 20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{cat}</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{fmt(total)}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <select className="form-control" style={{ width: 'auto' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="Pending">Pending</option>
          <option value="Approved">Approved</option>
          <option value="Rejected">Rejected</option>
        </select>
        {savedCategories.length > 0 && (
          <select className="form-control" style={{ width: 'auto' }} value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
            <option value="">All Categories</option>
            {savedCategories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading...</div>
      ) : expenses.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>💸</div>
          <div style={{ fontWeight: 600 }}>No expenses yet</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>Click "Add Expense" to record your first expense.</div>
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                {['Date', 'Title', 'Category', 'Amount', 'Mode', 'Bill Ref', canApprove ? 'Submitted By' : null, 'Status', 'Actions'].filter(Boolean).map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {expenses.map((exp, i) => {
                const sc = STATUS_COLORS[exp.status] || STATUS_COLORS.Pending;
                const canEdit = exp.status === 'Pending' && (!isEmployee || exp.submittedBy === user.id);
                const canDelete = exp.status !== 'Approved' && (!isEmployee ? true : (exp.submittedBy === user.id && exp.status === 'Pending'));
                return (
                  <tr key={exp.id} style={{ borderBottom: i < expenses.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <td style={{ padding: '10px 14px', fontSize: 13, whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{fmtDate(exp.expenseDate)}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13 }}>
                      <div style={{ fontWeight: 600 }}>{exp.title}</div>
                      {exp.notes && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{exp.notes}</div>}
                      {exp.status === 'Rejected' && exp.rejectionReason && (
                        <div style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>Rejected: {exp.rejectionReason}</div>
                      )}
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 13, whiteSpace: 'nowrap' }}>{exp.category || '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>{fmt(exp.amount)}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{exp.paymentMode}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)' }}>{exp.billReference || '—'}</td>
                    {canApprove && <td style={{ padding: '10px 14px', fontSize: 13 }}>{exp.submitter?.name || '—'}</td>}
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>{exp.status}</span>
                    </td>
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {canApprove && exp.status === 'Pending' && (
                          <>
                            <button className="btn btn-sm" style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', padding: '4px 10px', fontSize: 12 }} onClick={() => handleApprove(exp.id)}>Approve</button>
                            <button className="btn btn-sm" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', padding: '4px 10px', fontSize: 12 }} onClick={() => { setRejectModal(exp.id); setRejectReason(''); }}>Reject</button>
                          </>
                        )}
                        {canEdit && (
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(exp)}>Edit</button>
                        )}
                        {canDelete && (
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(exp.id)}>Delete</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: 20 }}>{editId ? 'Edit Expense' : 'Add Expense'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Title *</label>
                <input className="form-control" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Client site visit fuel" required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <input className="form-control" list="expense-categories" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="e.g. Fuel, Travel, Software..." />
                  <datalist id="expense-categories">
                    {savedCategories.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
                <div className="form-group">
                  <label className="form-label">Payment Mode *</label>
                  <select className="form-control" value={form.paymentMode} onChange={e => setForm({ ...form, paymentMode: e.target.value })} required>
                    <option value="">Select mode</option>
                    {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Amount (₹) *</label>
                  <input className="form-control" type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0.00" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Date *</label>
                  <input className="form-control" type="date" value={form.expenseDate} onChange={e => setForm({ ...form, expenseDate: e.target.value })} required />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">BILL / CHEQUE / RECEIPT REFERENCE NO. *</label>
                <input className="form-control" value={form.billReference} onChange={e => setForm({ ...form, billReference: e.target.value })} placeholder="e.g. Bill no., cheque no., receipt no." required />
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-control" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Any additional details..." />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : editId ? 'Update' : 'Submit Expense'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="modal-overlay" onClick={() => setRejectModal(null)}>
          <div className="modal confirm-modal" onClick={e => e.stopPropagation()}>
            <h3>Reject Expense</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>Optionally provide a reason so the employee knows what to correct.</p>
            <textarea className="form-control" rows={3} value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Reason for rejection (optional)" style={{ marginBottom: 16 }} />
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setRejectModal(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleReject}>Reject Expense</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Expenses;
