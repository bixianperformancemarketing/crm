import React, { useState } from 'react';
import { contentAPI } from '../../services/api';
import toast from 'react-hot-toast';

const TaskNotesSection = ({ task, user, onUpdate }) => {
  const isCreator = String(task.createdBy) === String(user?.id);
  const isAssignee = task.assignedTo && String(task.assignedTo) === String(user?.id);
  const canManage = user?.role === 'admin' || user?.role === 'owner';

  // Assigner notes: only creator can write
  const canEditAssigner = isCreator;
  // Assignee notes: assignee can write; admins/owners can also write
  const canEditAssignee = isAssignee || canManage;

  const [assignerNotes, setAssignerNotes] = useState(task.notes || '');
  const [assigneeNotes, setAssigneeNotes] = useState(task.assigneeNotes || '');

  const [editingAssigner, setEditingAssigner] = useState(false);
  const [editingAssignee, setEditingAssignee] = useState(false);
  const [assignerDraft, setAssignerDraft] = useState('');
  const [assigneeDraft, setAssigneeDraft] = useState('');
  const [savingAssigner, setSavingAssigner] = useState(false);
  const [savingAssignee, setSavingAssignee] = useState(false);

  const startEditAssigner = () => {
    setAssignerDraft(assignerNotes);
    setEditingAssigner(true);
  };

  const saveAssigner = async () => {
    setSavingAssigner(true);
    try {
      await contentAPI.update(task.id, { notes: assignerDraft });
      setAssignerNotes(assignerDraft);
      setEditingAssigner(false);
      onUpdate?.({ notes: assignerDraft });
      toast.success('Notes saved');
    } catch {
      toast.error('Failed to save notes');
    } finally {
      setSavingAssigner(false);
    }
  };

  const startEditAssignee = () => {
    setAssigneeDraft(assigneeNotes);
    setEditingAssignee(true);
  };

  const saveAssignee = async () => {
    setSavingAssignee(true);
    try {
      await contentAPI.update(task.id, { assigneeNotes: assigneeDraft });
      setAssigneeNotes(assigneeDraft);
      setEditingAssignee(false);
      onUpdate?.({ assigneeNotes: assigneeDraft });
      toast.success('Notes saved');
    } catch {
      toast.error('Failed to save notes');
    } finally {
      setSavingAssignee(false);
    }
  };

  const boxStyle = (hasContent, canEdit) => ({
    minHeight: 72, padding: '10px 12px', borderRadius: 8,
    background: 'var(--card-bg)', border: '1px solid var(--border)',
    fontSize: 13, color: hasContent ? 'var(--text)' : 'var(--text-muted)',
    cursor: canEdit ? 'text' : 'default',
    whiteSpace: 'pre-wrap', lineHeight: 1.7,
    transition: 'border-color 0.15s',
  });

  const sectionLabel = (name, fallback) => (
    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
      {name || fallback}
    </div>
  );

  return (
    <div>
      <div style={{ borderTop: '1px solid var(--border)', margin: '16px 0' }} />

      {/* Assigner Notes */}
      <div style={{ marginBottom: 16 }}>
        {sectionLabel(task.creator?.name ? `${task.creator.name}'s Notes` : null, 'Assigner Notes')}
        {editingAssigner ? (
          <div>
            <textarea
              autoFocus
              className="form-control"
              rows={4}
              value={assignerDraft}
              onChange={e => setAssignerDraft(e.target.value)}
              placeholder="Add notes for the assignee..."
              style={{ resize: 'vertical', width: '100%', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="btn btn-primary btn-sm" onClick={saveAssigner} disabled={savingAssigner}>
                {savingAssigner ? 'Saving...' : 'Save'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditingAssigner(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <div
            style={boxStyle(!!assignerNotes, canEditAssigner)}
            onClick={() => canEditAssigner && startEditAssigner()}
            onMouseEnter={e => canEditAssigner && (e.currentTarget.style.borderColor = 'var(--accent)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            title={canEditAssigner ? 'Click to edit' : undefined}
          >
            {assignerNotes || (canEditAssigner ? 'Click to add notes...' : 'No notes')}
          </div>
        )}
      </div>

      {/* Assignee Notes */}
      <div>
        {sectionLabel(task.assignee?.name ? `${task.assignee.name}'s Notes` : null, 'Assignee Notes')}
        {editingAssignee ? (
          <div>
            <textarea
              autoFocus
              className="form-control"
              rows={4}
              value={assigneeDraft}
              onChange={e => setAssigneeDraft(e.target.value)}
              placeholder="Add your notes here..."
              style={{ resize: 'vertical', width: '100%', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="btn btn-primary btn-sm" onClick={saveAssignee} disabled={savingAssignee}>
                {savingAssignee ? 'Saving...' : 'Save'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditingAssignee(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <div
            style={boxStyle(!!assigneeNotes, canEditAssignee)}
            onClick={() => canEditAssignee && startEditAssignee()}
            onMouseEnter={e => canEditAssignee && (e.currentTarget.style.borderColor = 'var(--accent)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            title={canEditAssignee ? 'Click to edit' : undefined}
          >
            {assigneeNotes || (canEditAssignee ? 'Click to add notes...' : 'No notes')}
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskNotesSection;
