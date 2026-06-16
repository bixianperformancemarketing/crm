import React, { useState } from 'react';
import { contentAPI } from '../../services/api';
import toast from 'react-hot-toast';

const TaskNotesSection = ({ task, user, onUpdate }) => {
  const isAssignee = task.assignedTo && String(task.assignedTo) === String(user?.id);
  const canManage = user?.role === 'admin' || user?.role === 'owner';
  const canEdit = isAssignee || canManage;

  const [notes, setNotes] = useState(task.assigneeNotes || '');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const start = () => { setDraft(notes); setEditing(true); };

  const save = async () => {
    setSaving(true);
    try {
      await contentAPI.update(task.id, { assigneeNotes: draft });
      setNotes(draft);
      setEditing(false);
      onUpdate?.({ assigneeNotes: draft });
      toast.success('Notes saved');
    } catch {
      toast.error('Failed to save notes');
    } finally {
      setSaving(false);
    }
  };

  const label = task.assignee?.name ? `${task.assignee.name}'s Notes` : 'Assignee Notes';

  return (
    <div>
      <div style={{ borderTop: '1px solid var(--border)', margin: '16px 0' }} />
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
        {label}
      </div>
      {editing ? (
        <div>
          <textarea
            autoFocus
            className="form-control"
            rows={4}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="Add your notes here..."
            style={{ resize: 'vertical', width: '100%', boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => canEdit && start()}
          onMouseEnter={e => canEdit && (e.currentTarget.style.borderColor = 'var(--accent)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
          title={canEdit ? 'Click to edit' : undefined}
          style={{
            minHeight: 72, padding: '10px 12px', borderRadius: 8,
            background: 'var(--card-bg)', border: '1px solid var(--border)',
            fontSize: 13, color: notes ? 'var(--text)' : 'var(--text-muted)',
            cursor: canEdit ? 'text' : 'default',
            whiteSpace: 'pre-wrap', lineHeight: 1.7,
            transition: 'border-color 0.15s',
          }}
        >
          {notes || (canEdit ? 'Click to add notes...' : 'No notes')}
        </div>
      )}
    </div>
  );
};

export default TaskNotesSection;
