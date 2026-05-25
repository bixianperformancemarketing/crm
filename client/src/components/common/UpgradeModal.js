import React from 'react';

const UpgradeModal = ({ onClose, message, limitType, plan }) => {
  const companyPhone = process.env.REACT_APP_COMPANY_PHONE || '+91 98765 43210';
  const companyEmail = process.env.REACT_APP_COMPANY_EMAIL || 'hello@youragency.com';
  const waLink = `https://wa.me/${companyPhone.replace(/\D/g, '')}?text=${encodeURIComponent('Hi! I would like to upgrade my CRM plan. Please help.')}`;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal upgrade-modal" onClick={(e) => e.stopPropagation()}>
        <div className="upgrade-icon">⚡</div>
        <h2>Upgrade Required</h2>
        <p className="upgrade-message">{message || `You have reached your ${limitType || 'plan'} limit. Upgrade to continue.`}</p>
        <div className="upgrade-current">
          <span>Current Plan: </span>
          <span className="plan-badge">{plan || 'Current'}</span>
        </div>
        <div className="upgrade-actions">
          <a href={waLink} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp">
            <span>📱</span> Chat on WhatsApp
          </a>
          <a href={`mailto:${companyEmail}`} className="btn btn-email">
            <span>✉️</span> Email Us
          </a>
        </div>
        <button className="modal-close" onClick={onClose}>×</button>
      </div>
      <style>{`
        .upgrade-modal { max-width: 420px; text-align: center; padding: 40px 30px; }
        .upgrade-icon { font-size: 48px; margin-bottom: 16px; }
        .upgrade-modal h2 { color: #e94560; margin-bottom: 12px; font-size: 22px; }
        .upgrade-message { color: #a0a0c0; margin-bottom: 20px; line-height: 1.5; }
        .upgrade-current { margin-bottom: 24px; color: #e2e2f0; font-size: 14px; }
        .plan-badge { background: rgba(233,69,96,0.15); color: #e94560; padding: 2px 10px; border-radius: 20px; text-transform: capitalize; font-weight: 600; }
        .upgrade-actions { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
        .btn-whatsapp { background: #25d366; color: #fff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600; display: flex; align-items: center; gap: 8px; font-size: 14px; }
        .btn-whatsapp:hover { background: #1ebe5d; }
        .btn-email { background: #1e1e3a; border: 1px solid #3a3a5c; color: #e2e2f0; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600; display: flex; align-items: center; gap: 8px; font-size: 14px; }
        .btn-email:hover { background: #2a2a4a; }
      `}</style>
    </div>
  );
};

export default UpgradeModal;
