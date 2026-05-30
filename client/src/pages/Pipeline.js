import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  DragDropContext, Droppable, Draggable,
  MouseSensor, TouchSensor, useSensor, useSensors,
} from '@hello-pangea/dnd';
import toast from 'react-hot-toast';
import Layout from '../components/layout/Layout';
import { leadsAPI } from '../services/api';
import { getPriorityColor, getInitials } from '../utils/helpers';
import './Pipeline.css';

const COLUMNS = ['New', 'Discussion', 'Meeting', 'Quotation', 'Won', 'Lost'];
const COL_COLORS = { New: '#0ea5e9', Discussion: '#f59e0b', Meeting: '#7c3aed', Quotation: '#e94560', Won: '#22c55e', Lost: '#6b7280' };

const Pipeline = () => {
  const [pipeline, setPipeline] = useState({});
  const [loading, setLoading] = useState(true);

  // Require 10px movement on mouse (prevents accidental click-drags),
  // and 250ms hold + 5px tolerance on touch (prevents scroll-drags).
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 10 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  );

  const loadPipeline = async () => {
    try {
      const { data } = await leadsAPI.getPipeline();
      setPipeline(data.pipeline || {});
    } catch { toast.error('Failed to load pipeline'); }
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
      await leadsAPI.update(draggableId, { status: destination.droppableId });
      toast.success(`Moved to ${destination.droppableId}`);
    } catch {
      toast.error('Failed to update status');
      loadPipeline();
    }
  };

  if (loading) return <Layout title="Pipeline"><div className="loading-spinner"><div className="spinner" /></div></Layout>;

  return (
    <Layout title="Pipeline">
      <div className="page-header">
        <div className="page-title">Sales Pipeline</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Drag cards to update status</div>
      </div>

      <DragDropContext onDragEnd={onDragEnd} sensors={sensors}>
        <div className="pipeline-board">
          {COLUMNS.map((col) => {
            const leads = pipeline[col] || [];
            return (
              <div className="pipeline-column" key={col}>
                <div className="pipeline-col-header">
                  <div className="pipeline-col-title" style={{ color: COL_COLORS[col] }}>{col}</div>
                  <div className="pipeline-col-count">{leads.length}</div>
                </div>
                <Droppable droppableId={col}>
                  {(provided, snapshot) => (
                    <div className="pipeline-col-body" ref={provided.innerRef} {...provided.droppableProps} style={{ background: snapshot.isDraggingOver ? 'rgba(233,69,96,0.04)' : undefined }}>
                      {leads.map((lead, index) => (
                        <Draggable key={String(lead.id)} draggableId={String(lead.id)} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`kanban-card${snapshot.isDragging ? ' dragging' : ''}`}
                              style={{ ...provided.draggableProps.style, borderLeft: `3px solid ${COL_COLORS[col]}` }}
                            >
                              <div className="kc-name">
                                <Link to={`/leads/${lead.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>{lead.name}</Link>
                                {lead.isHot && <span style={{ fontSize: 9, background: 'rgba(239,68,68,0.2)', color: '#ef4444', padding: '1px 5px', borderRadius: 10, fontWeight: 700 }}>HOT</span>}
                              </div>
                              {lead.phone && <div className="kc-phone">📞 {lead.phone}</div>}
                              <div className="kc-meta">
                                <span className="kc-source">{lead.source}</span>
                                <span style={{ fontSize: 10, background: `rgba(${getPriorityColor(lead.priority).slice(1).match(/.{2}/g)?.map((x) => parseInt(x,16)).join(',')},0.15)`, color: getPriorityColor(lead.priority), padding: '1px 6px', borderRadius: 10, fontWeight: 700 }}>{lead.priority}</span>
                                {lead.assignedAgent && (
                                  <div className="kc-agent">
                                    <div className="kc-agent-dot">{getInitials(lead.assignedAgent.name)}</div>
                                    <span>{lead.assignedAgent.name.split(' ')[0]}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      {leads.length === 0 && !snapshot.isDraggingOver && (
                        <div style={{ textAlign: 'center', padding: '20px 10px', color: 'var(--text-muted)', fontSize: 12 }}>No leads</div>
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

export default Pipeline;
