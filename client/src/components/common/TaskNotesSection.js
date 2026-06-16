import React, { useState } from 'react';
import { contentAPI } from '../../services/api';
import toast from 'react-hot-toast';

const NoteBox = ({ value, canEdit, placeholder, onSave }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const start = () => { setDraft(value); setEditing(true); };

  const save = async () => {
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } catch {
      // error toasted by caller
    } finally {
      setSaving(false);
    }
  };

  return editing ? (
    <div>
      <textarea
        autoFocus
        className="form-control"
        rows={4}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        placeholder={placeholder}
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
        fontSize: 13, color: value ? 'var(--text)' : 'var(--text-muted)',
        cursor: canEdit ? 'text' : 'default',
        whiteSpace: 'pre-wrap', lineHeight: 1.7,
        transition: 'border-color 0.15s',
      }}
    >
      {value || (canEdit ? 'Click to add notes...' : 'No notes')}
    </div>
  );
};

const Label = ({ text }) => (
  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
    {text}
  </div>
);

const TaskNotesSection = ({ task, user, onUpdate }) => {
  const isCreator = String(task.createdBy) === String(user?.id);
  const isAssignee = task.assignedTo && String(task.assignedTo) === String(user?.id);
  const canManage = user?.role === 'admin' || user?.role === 'owner';
  const isSelfTask = task.assignedTo && String(task.createdBy) === String(task.assignedTo);

  // Local state so saves reflect immediately without waiting for parent re-render
  const [assignerNotes, setAssignerNotes] = useState(task.notes || '');
  const [assigneeNotes, setAssigneeNotes] = useState(task.assigneeNotes || '');

  const saveAssigner = async (text) => {
    try {
      await contentAPI.update(task.id, { notes: text });
      setAssignerNotes(text);
      onUpdate?.({ notes: text });
      toast.success('Notes saved');
    } catch {
      toast.error('Failed to save notes');
      throw new Error();
    }
  };

  const saveAssignee = async (text) => {
    try {
      await contentAPI.update(task.id, { assigneeNotes: text });
      setAssigneeNotes(text);
      onUpdate?.({ assigneeNotes: text });
      toast.success('Notes saved');
    } catch {
      toast.error('Failed to save notes');
      throw new Error();
    }
  };

  return (
    <div>
      <div style={{ borderTop: '1px solid var(--border)', margin: '16px 0' }} />

      {isSelfTask ? (
        /* Self-task: single notes field */
        <div>
          <Label text="Notes" />
          <NoteBox
            value={assignerNotes}
            canEdit={isCreator || canManage}
            placeholder="Add notes..."
            onSave={saveAssigner}
          />
        </div>
      ) : (
        /* Assigned to someone else: separate assigner + assignee notes */
        <>
          <div style={{ marginBottom: 16 }}>
            <Label text={task.creator?.name ? `${task.creator.name}'s Notes` : 'Assigner Notes'} />
            <NoteBox
              value={assignerNotes}
              canEdit={isCreator}
              placeholder="Add notes for the assignee..."
              onSave={saveAssigner}
            />
          </div>
          <div>
            <Label text={task.assignee?.name ? `${task.assignee.name}'s Notes` : 'Assignee Notes'} />
            <NoteBox
              value={assigneeNotes}
              canEdit={isAssignee || canManage}
              placeholder="Add your notes here..."
              onSave={saveAssignee}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default TaskNotesSection;
