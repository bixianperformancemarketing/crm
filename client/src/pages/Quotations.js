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
  const [sendingWhatsapp, setSendingWhatsapp] = useState(null);
  const [form, setForm] = useState({ clientName: '', clientEmail: '', clientPhone: '', clientAddress: '', clientGST: '', gstPercent: 18, terms: '', notes: '', validUntil: '', items: [emptyItem()] });
  const [editQuotation, setEditQuotation] = useState(null);
  const [editForm, setEditForm] = useState(null);

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

  const updateEditItem = (i, field, val) => {
    const items = [...editForm.items];
    items[i] = { ...items[i], [field]: val };
    if (field === 'quantity' || field === 'unitPrice') {
      items[i].totalPrice = parseFloat(items[i].quantity || 0) * parseFloat(items[i].unitPrice || 0);
    }
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

  const openEdit = async (q) => {
    try {
      const { data } = await quotationsAPI.get(q.id);
      const qData = data.quotation;
      setEditForm({
        clientName: qData.clientName || '',
        clientEmail: qData.clientEmail || '',
        clientPhone: qData.clientPhone || '',
        clientAddress: qData.clientAddress || '',
        clientGST: qData.clientGST || '',
        gstPercent: qData.gstPercent || 18,
        terms: qData.terms || '',
        notes: qData.notes || '',
        validUntil: qData.validUntil ? qData.validUntil.slice(0, 10) : '',
        items: qData.items?.length
          ? qData.items.map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, totalPrice: i.totalPrice }))
          : [emptyItem()],
      });
      setEditQuotation(q);
    } catch {
      toast.error('Failed to load quotation details');
    }
  };

  const closeEdit = () => { setEditQuotation(null); setEditForm(null); };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (!editForm.clientName.trim()) return toast.error('Client name is required');
    if (!editForm.clientPhone.trim()) return toast.error('Phone number is required');
    if (!editForm.clientEmail.trim()) return toast.error('Email is required');
    if (!editForm.clientAddress.trim()) return toast.error('Address is required');
    const validItems = editForm.items.filter((i) => i.description?.trim());
    if (!validItems.length) return toast.error('At least one item with a description is required');
    setSaving(true);
    try {
      await quotationsAPI.update(editQuotation.id, { ...editForm, items: validItems });
      toast.success('Quotation updated');
      closeEdit();
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update quotation');
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

  const handleWhatsapp = async (q) => {
    setSendingWhatsapp(q.id);
    try {
      const { data } = await quotationsAPI.whatsappShare(q.id);
      const API_URL = process.env.REACT_APP_API_URL || window.location.origin;
      const fileUrl = `${API_URL}/uploads/shared/${data.fileName}`;
      const phone = data.phone.replace(/\D/g, '');
      const wa = phone.length === 10 ? `91${phone}` : phone;
      const msg = `Hi ${data.clientName}, your quotation ${data.number} for ${formatCurrency(data.totalAmount)} is ready.\n\nDownload it here: ${fileUrl}\n\nReply if you have any questions.`;
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
                        {q.status !== 'Approved' && (
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(q)}>✏️ Edit</button>
                        )}
                        {q.status === 'Draft' && <button className="btn btn-ghost btn-sm" onClick={() => handleStatus(q.id, 'Sent')}>Mark as Sent</button>}
                        {q.status === 'Sent' && <button className="btn btn-success btn-sm" onClick={() => handleStatus(q.id, 'Approved')}>Client Accepted</button>}
                        {q.status === 'Sent' && <button className="btn btn-ghost btn-sm" onClick={() => handleStatus(q.id, 'Rejected')}>Client Declined</button>}
                        {q.status === 'Sent' && <button className="btn btn-ghost btn-sm" style={{ color: '#a78bfa' }} onClick={() => handleStatus(q.id, 'Not Responding')}>Not Responding</button>}
                        {hasFeature('canUsePDF') && <button className="btn btn-ghost btn-sm" onClick={() => handlePDF(q.id, q.quotationNumber)}>📄 PDF</button>}
                        {hasFeature('canUsePDF') && q.clientEmail && <button className="btn btn-ghost btn-sm" onClick={() => handleEmail(q.id)} disabled={sendingEmail === q.id} title="Email quotation to client">{sendingEmail === q.id ? '...' : '✉️'}</button>}
                        {hasFeature('canUsePDF') && q.clientPhone && (
                          <button className="btn btn-ghost btn-sm" onClick={() => handleWhatsapp(q)} disabled={sendingWhatsapp === q.id} title="Send via WhatsApp" style={{ color: '#25d366', display: 'inline-flex', alignItems: 'center' }}>
                            {sendingWhatsapp === q.id ? '...' : (
                              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                              </svg>
                            )}
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

      {/* Create Quotation Modal */}
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

      {/* Edit Quotation Modal */}
      {editQuotation && editForm && (
        <div className="modal-overlay" onClick={closeEdit}>
          <div className="modal" style={{ maxWidth: 700 }} onClick={(e) => e.stopPropagation()}>
            <h3>Edit Quotation — {editQuotation.quotationNumber}</h3>
            <button className="modal-close" onClick={closeEdit}>×</button>
            <form onSubmit={handleEdit}>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Client Name *</label><input className="form-control" value={editForm.clientName} onChange={(e) => setEditForm({ ...editForm, clientName: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">Client Email *</label><input className="form-control" type="email" value={editForm.clientEmail} onChange={(e) => setEditForm({ ...editForm, clientEmail: e.target.value })} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Phone *</label><input className="form-control" value={editForm.clientPhone} onChange={(e) => setEditForm({ ...editForm, clientPhone: e.target.value.replace(/[^0-9+]/g, '') })} placeholder="+91 9876543210" /></div>
                <div className="form-group"><label className="form-label">GST</label><input className="form-control" value={editForm.clientGST} onChange={(e) => setEditForm({ ...editForm, clientGST: e.target.value })} /></div>
              </div>
              <div className="form-group"><label className="form-label">Address *</label><textarea className="form-control" rows={2} value={editForm.clientAddress} onChange={(e) => setEditForm({ ...editForm, clientAddress: e.target.value })} /></div>

              <h4 style={{ margin: '16px 0 10px', fontSize: 13, color: 'var(--text-muted)' }}>Line Items</h4>
              <table className="items-table">
                <thead><tr><th>Description</th><th style={{ width: 110 }}>Qty</th><th style={{ width: 130 }}>Unit Price</th><th style={{ width: 130 }}>Total</th><th style={{ width: 40 }}></th></tr></thead>
                <tbody>
                  {editForm.items.map((item, i) => (
                    <tr key={i}>
                      <td><input value={item.description} onChange={(e) => updateEditItem(i, 'description', e.target.value)} placeholder="Service description" /></td>
                      <td><input type="number" min="0" step="0.01" value={item.quantity} onChange={(e) => updateEditItem(i, 'quantity', e.target.value)} /></td>
                      <td><input type="number" min="0" step="0.01" value={item.unitPrice} onChange={(e) => updateEditItem(i, 'unitPrice', e.target.value)} /></td>
                      <td style={{ color: '#f59e0b', fontWeight: 600 }}>₹{parseFloat(item.totalPrice || 0).toLocaleString('en-IN')}</td>
                      <td><button type="button" style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 16 }} onClick={() => setEditForm({ ...editForm, items: editForm.items.filter((_, j) => j !== i) })}>×</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => setEditForm({ ...editForm, items: [...editForm.items, emptyItem()] })}>+ Add Item</button>

              <div className="totals-box">
                <div className="total-row"><span>Subtotal</span><span>{formatCurrency(editSubtotal)}</span></div>
                <div className="total-row"><span>GST <input type="number" value={editForm.gstPercent} onChange={(e) => setEditForm({ ...editForm, gstPercent: e.target.value })} style={{ width: 50, background: 'transparent', border: '1px solid #2a2a4a', color: 'var(--text)', borderRadius: 4, padding: '2px 4px', fontSize: 12 }} />%</span><span>{formatCurrency(editGstAmount)}</span></div>
                <div className="total-row grand"><span>Total</span><span>{formatCurrency(editTotal)}</span></div>
              </div>

              <div className="form-row" style={{ marginTop: 16 }}>
                <div className="form-group"><label className="form-label">Valid Until</label><input className="form-control" type="date" value={editForm.validUntil} onChange={(e) => setEditForm({ ...editForm, validUntil: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">Terms</label><input className="form-control" value={editForm.terms} onChange={(e) => setEditForm({ ...editForm, terms: e.target.value })} /></div>
              </div>
              <div className="form-group"><label className="form-label">Notes</label><textarea className="form-control" rows={2} value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} /></div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={closeEdit}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {upgradeModal && <UpgradeModal message={upgradeModal.message} limitType={upgradeModal.limitType} plan={org?.plan} onClose={() => setUpgradeModal(null)} />}
    </Layout>
  );
};

export default Quotations;
