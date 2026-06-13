import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import toast from 'react-hot-toast';
import Layout from '../components/layout/Layout';
import { leadsAPI } from '../services/api';
import { getPriorityColor, getInitials } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';
import './Pipeline.css';

const COLUMNS = ['New', 'Discussion', 'Meeting', 'Quotation', 'Review', 'Won', 'Lost', 'Repeated'];
const COL_DISPLAY = { New: 'New', Discussion: 'Discussion', Meeting: 'Meeting Done', Quotation: 'Quotation', Review: 'Review', Won: 'Won', Lost: 'Lost', Repeated: 'Repeated' };
const COL_COLORS = { New: '#0ea5e9', Discussion: '#f59e0b', Meeting: '#7c3aed', Quotation: '#e94560', Review: '#f97316', Won: '#22c55e', Lost: '#6b7280', Repeated: '#06b6d4' };

const Pipeline = () => {
  const { user } = useAuth();
  const [pipeline, setPipeline] = useState({});
  const [loading, setLoading] = useState(true);
  const isEmployee = user?.role === 'employee';
  const canApprove = user?.role === 'admin' || user?.role === 'owner';

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

    const dest = destination.droppableId;

    if (isEmployee && (dest === 'Won' || dest === 'Lost' || dest === 'Repeated')) {
      toast.error('Only admin can move leads to Won, Lost or Repeated');
      return;
    }

    const newPipeline = { ...pipeline };
    const src = [...(newPipeline[source.droppableId] || [])];
    const dst = [...(newPipeline[dest] || [])];
    const [moved] = src.splice(source.index, 1);
    dst.splice(destination.index, 0, { ...moved, status: dest });
    newPipeline[source.droppableId] = src;
    newPipeline[dest] = dst;
    setPipeline(newPipeline);

    try {
      await leadsAPI.update(draggableId, { status: dest });
      toast.success(`Moved to ${COL_DISPLAY[dest]}`);
    } catch {
      toast.error('Failed to update status');
      loadPipeline();
    }
  };

  const approveReviewLead = async (leadId, newStatus) => {
    try {
      await leadsAPI.update(leadId, { status: newStatus });
      toast.success(`Lead marked as ${newStatus}`);
      loadPipeline();
    } catch { toast.error('Failed to update lead'); }
  };

  if (loading) return <Layout title="Leads Pipeline"><div className="loading-spinner"><div className="spinner" /></div></Layout>;

  return (
    <Layout title="Leads Pipeline">
      <div className="page-header">
        <div className="page-title">Leads Pipeline</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Drag cards to update status</div>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="pipeline-board">
          {COLUMNS.map((col) => {
            const leads = pipeline[col] || [];
            return (
              <div className="pipeline-column" key={col}>
                <div className="pipeline-col-header">
                  <div className="pipeline-col-title" style={{ color: COL_COLORS[col] }}>{COL_DISPLAY[col]}</div>
                  <div className="pipeline-col-count">{leads.length}</div>
                </div>
                <Droppable droppableId={col} isDropDisabled={isEmployee && (col === 'Won' || col === 'Lost')}>
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
                              {col === 'Review' && canApprove && (
                                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); approveReviewLead(lead.id, 'Won'); }}
                                    style={{ flex: 1, padding: '4px 0', fontSize: 11, fontWeight: 700, background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 6, cursor: 'pointer' }}
                                  >Won</button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); approveReviewLead(lead.id, 'Lost'); }}
                                    style={{ flex: 1, padding: '4px 0', fontSize: 11, fontWeight: 700, background: 'rgba(107,114,128,0.15)', color: '#6b7280', border: '1px solid rgba(107,114,128,0.3)', borderRadius: 6, cursor: 'pointer' }}
                                  >Lost</button>
                                </div>
                              )}
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
