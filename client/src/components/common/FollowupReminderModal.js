import React from 'react';
import { useNavigate } from 'react-router-dom';

const FollowupReminderModal = ({ reminder, onDismiss }) => {
  const navigate = useNavigate();

  if (!reminder) return null;

  const scheduledTime = reminder.scheduledAt
    ? new Date(reminder.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  const handleGoToFollowups = () => {
    onDismiss();
    navigate('/followups');
  };

  return (
    <div
      onClick={onDismiss}
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'fadeIn 0.2s ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#1e1e3a',
          border: '2px solid #e94560',
          borderRadius: '16px',
          padding: '36px 32px',
          maxWidth: '420px',
          width: '90%',
          boxShadow: '0 0 60px rgba(233,69,96,0.4), 0 20px 60px rgba(0,0,0,0.5)',
          textAlign: 'center',
          animation: 'slideUp 0.25s ease',
        }}
      >
        <div style={{ fontSize: '52px', marginBottom: '12px', animation: 'pulse 1s ease infinite' }}>⏰</div>

        <h2 style={{ color: '#e94560', fontSize: '22px', fontWeight: 700, margin: '0 0 8px' }}>
          Follow-up Reminder
        </h2>

        <p style={{ color: '#e2e2f0', fontSize: '16px', margin: '0 0 6px', fontWeight: 500 }}>
          {reminder.message}
        </p>

        {scheduledTime && (
          <p style={{ color: '#a0a0c0', fontSize: '13px', margin: '0 0 6px' }}>
            Scheduled at {scheduledTime}
          </p>
        )}

        {reminder.note && (
          <p style={{
            color: '#c0c0e0', fontSize: '13px', margin: '12px 0 0',
            background: '#13132a', borderRadius: '8px', padding: '10px 14px',
            textAlign: 'left', borderLeft: '3px solid #e94560',
          }}>
            {reminder.note}
          </p>
        )}

        <div style={{ display: 'flex', gap: '12px', marginTop: '28px', justifyContent: 'center' }}>
          <button
            onClick={onDismiss}
            style={{
              padding: '10px 24px', borderRadius: '8px',
              background: 'transparent', border: '1px solid #3a3a5c',
              color: '#a0a0c0', cursor: 'pointer', fontSize: '14px', fontWeight: 500,
            }}
          >
            Dismiss
          </button>
          <button
            onClick={handleGoToFollowups}
            style={{
              padding: '10px 24px', borderRadius: '8px',
              background: '#e94560', border: 'none',
              color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 600,
            }}
          >
            View Followup
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { transform: translateY(30px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        @keyframes pulse { 0%,100% { transform: scale(1) } 50% { transform: scale(1.15) } }
      `}</style>
    </div>
  );
};

export default FollowupReminderModal;
