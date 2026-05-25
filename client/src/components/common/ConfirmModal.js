import React from 'react';

const ConfirmModal = ({ title, message, onConfirm, onCancel, confirmText = 'Confirm', confirmClass = 'btn-danger', loading = false }) => (
  <div className="modal-overlay" onClick={onCancel}>
    <div className="modal confirm-modal" onClick={(e) => e.stopPropagation()}>
      <h3>{title || 'Confirm Action'}</h3>
      <p>{message || 'Are you sure you want to proceed?'}</p>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onCancel} disabled={loading}>Cancel</button>
        <button className={`btn ${confirmClass}`} onClick={onConfirm} disabled={loading}>
          {loading ? 'Processing...' : confirmText}
        </button>
      </div>
    </div>
  </div>
);

export default ConfirmModal;
