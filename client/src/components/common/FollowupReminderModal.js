import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const playAlertSound = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const beep = (freq, start, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration);
    };
    beep(880, 0, 0.15);
    beep(1100, 0.2, 0.15);
    beep(880, 0.4, 0.25);
  } catch {}
};

const FollowupReminderModal = ({ reminder, onDismiss }) => {
  const navigate = useNavigate();

  useEffect(() => {
    if (reminder) playAlertSound();
  }, [reminder]);

  if (!reminder) return null;

  const isTask = reminder.type === 'task';
  const scheduledTime = reminder.scheduledAt
    ? new Date(reminder.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : reminder.dueTime || null;

  const handleGoTo = () => {
    onDismiss();
    navigate(isTask ? '/tasks' : '/followups');
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
          border: `2px solid ${isTask ? '#f97316' : '#e94560'}`,
          borderRadius: '16px',
          padding: '36px 32px',
          maxWidth: '420px',
          width: '90%',
          boxShadow: `0 0 60px ${isTask ? 'rgba(249,115,22,0.4)' : 'rgba(233,69,96,0.4)'}, 0 20px 60px rgba(0,0,0,0.5)`,
          textAlign: 'center',
          animation: 'slideUp 0.25s ease',
        }}
      >
        <div style={{ fontSize: '52px', marginBottom: '12px', animation: 'pulse 1s ease infinite' }}>
          {isTask ? '📋' : '⏰'}
        </div>

        <h2 style={{ color: isTask ? '#f97316' : '#e94560', fontSize: '22px', fontWeight: 700, margin: '0 0 8px' }}>
          {isTask ? 'Task Reminder' : 'Follow-up Reminder'}
        </h2>

        <p style={{ color: '#e2e2f0', fontSize: '16px', margin: '0 0 6px', fontWeight: 500 }}>
          {reminder.message}
        </p>

        {scheduledTime && (
          <p style={{ color: '#a0a0c0', fontSize: '13px', margin: '0 0 6px' }}>
            Due at {scheduledTime}
          </p>
        )}

        {reminder.note && (
          <p style={{
            color: '#c0c0e0', fontSize: '13px', margin: '12px 0 0',
            background: '#13132a', borderRadius: '8px', padding: '10px 14px',
            textAlign: 'left', borderLeft: `3px solid ${isTask ? '#f97316' : '#e94560'}`,
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
            onClick={handleGoTo}
            style={{
              padding: '10px 24px', borderRadius: '8px',
              background: isTask ? '#f97316' : '#e94560', border: 'none',
              color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 600,
            }}
          >
            {isTask ? 'View Task' : 'View Followup'}
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
