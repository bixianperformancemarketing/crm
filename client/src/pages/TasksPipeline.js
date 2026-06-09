import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import toast from 'react-hot-toast';
import Layout from '../components/layout/Layout';
import { contentAPI } from '../services/api';
import { getPriorityColor, getInitials } from '../utils/helpers';
import './Pipeline.css';

const COLUMNS = ['Overdue', 'To Do Today', 'In Progress', 'Review', 'Approved', 'Not Approved'];
const COL_COLORS = {
  Overdue: '#ef4444',
  'To Do Today': '#0ea5e9',
  'In Progress': '#a78bfa',
  Review: '#f59e0b',
  Approved: '#22c55e',
  'Not Approved': '#ef4444',
};

const fmtDate = (d) => {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
};

const TasksPipeline = () => {
  const [pipeline, setPipeline] = useState({});
  const [loading, setLoading] = useState(true);

  const loadPipeline = async () => {
    try {
      const { data } = await contentAPI.getPipeline();
      setPipeline(data.pipeline || {});
    } catch { toast.error('Failed to load tasks pipeline'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadPipeline(); }, []);

  const onDragEnd = async (result) => {
    const { source, destination, draggableId } = result;
    if (!destination || source.droppableId === destination.droppableId) return;

    const newPipeline = { ...pipeline };
    const src = [...(newPipeline[source.droppableId] || [])];
    const dst = [...(newPipeline[destination.droppableId] || [])];
    const [moved] = src.splice(source.index, 1);
    dst.splice(destination.index, 0, { ...moved, status: destination.droppableId });
    newPipeline[source.droppableId] = src;
    newPipeline[destination.droppableId] = dst;
    setPipeline(newPipeline);

    try {
      await contentAPI.update(draggableId, { status: destination.droppableId });
      toast.success(`Moved to ${destination.droppableId}`);
    } catch {
      toast.error('Failed to update status');
      loadPipeline();
    }
  };

  if (loading) return <Layout title="Tasks Pipeline"><div className="loading-spinner"><div className="spinner" /></div></Layout>;

  return (
    <Layout title="Tasks Pipeline">
      <div className="page-header">
        <div className="page-title">Tasks Pipeline</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Drag cards to update status</div>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="pipeline-board">
          {COLUMNS.map((col) => {
            const tasks = pipeline[col] || [];
            const color = COL_COLORS[col];
            return (
              <div className="pipeline-column" key={col}>
                <div className="pipeline-col-header">
                  <div className="pipeline-col-title" style={{ color }}>{col}</div>
                  <div className="pipeline-col-count">{tasks.length}</div>
                </div>
                <Droppable droppableId={col}>
                  {(provided, snapshot) => (
                    <div
                      className="pipeline-col-body"
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      style={{ background: snapshot.isDraggingOver ? `${color}0a` : undefined }}
                    >
                      {tasks.map((task, index) => (
                        <Draggable key={String(task.id)} draggableId={String(task.id)} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`kanban-card${snapshot.isDragging ? ' dragging' : ''}`}
                              style={{ ...provided.draggableProps.style, borderLeft: `3px solid ${color}` }}
                            >
                              <div className="kc-name">{task.title}</div>
                              {task.lead && (
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                                  🔗 {task.lead.name}
                                </div>
                              )}
                              <div className="kc-meta">
                                {task.dueDate && (
                                  <span className="kc-source">📅 {fmtDate(task.dueDate)}</span>
                                )}
                                {task.priority && (
                                  <span style={{
                                    fontSize: 10,
                                    background: `rgba(${getPriorityColor(task.priority).slice(1).match(/.{2}/g)?.map((x) => parseInt(x, 16)).join(',')},0.15)`,
                                    color: getPriorityColor(task.priority),
                                    padding: '1px 6px', borderRadius: 10, fontWeight: 700,
                                  }}>{task.priority}</span>
                                )}
                                {task.assignee && (
                                  <div className="kc-agent">
                                    <div className="kc-agent-dot">{getInitials(task.assignee.name)}</div>
                                    <span>{task.assignee.name.split(' ')[0]}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      {tasks.length === 0 && !snapshot.isDraggingOver && (
                        <div style={{ textAlign: 'center', padding: '20px 10px', color: 'var(--text-muted)', fontSize: 12 }}>No tasks</div>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>
    </Layout>
  );
};

export default TasksPipeline;
