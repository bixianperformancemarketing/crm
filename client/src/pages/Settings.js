import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import Layout from '../components/layout/Layout';
import { orgAPI, workspaceAPI, metaIntegrationAPI, authAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import PasswordInput from '../components/ui/PasswordInput';

const API_BASE = process.env.REACT_APP_API_URL || window.location.origin;

const CopyButton = ({ value }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button onClick={handleCopy} style={{ padding: '6px 14px', fontSize: 12, background: copied ? '#10b981' : 'var(--surface-2)', color: copied ? '#fff' : 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s' }}>
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
};

const WebhookRow = ({ label, url }) => (
  <div style={{ marginBottom: 16 }}>
    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <input readOnly value={url} style={{ flex: 1, padding: '8px 12px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, color: 'var(--text)', fontFamily: 'monospace' }} onClick={e => e.target.select()} />
      <CopyButton value={url} />
    </div>
  </div>
);

const WebhooksTab = ({ org }) => {
  const canUse = org?.canUseWebhooks;
  const orgToken = org?.webhookToken;
  const orgBase = `${API_BASE}/webhooks/${orgToken}`;

  const [subTab, setSubTab] = useState('workspaces');
  const [workspaces, setWorkspaces] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openWs, setOpenWs] = useState(null);

  // Add route form
  const [showAddRoute, setShowAddRoute] = useState(false);
  const [routeForm, setRouteForm] = useState({ workspaceId: '', matchType: 'page_id', matchValue: '', label: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!canUse) return;
    Promise.all([orgAPI.getWebhookWorkspaces(), orgAPI.getWebhookRoutes()])
      .then(([wsRes, routeRes]) => {
        setWorkspaces(wsRes.data.workspaces || []);
        setRoutes(routeRes.data.routes || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [canUse]);

  const addRoute = async (e) => {
    e.preventDefault();
    if (!routeForm.workspaceId || !routeForm.matchValue.trim()) return toast.error('Fill in all fields');
    setSaving(true);
    try {
      const { data } = await orgAPI.createWebhookRoute({
        workspaceId: parseInt(routeForm.workspaceId),
        matchType: routeForm.matchType,
        matchValue: routeForm.matchValue.trim(),
        label: routeForm.label.trim() || routeForm.matchValue.trim(),
      });
      setRoutes(r => [data.route, ...r]);
      setRouteForm({ workspaceId: '', matchType: 'page_id', matchValue: '', label: '' });
      setShowAddRoute(false);
      toast.success('Route added');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add route');
    } finally { setSaving(false); }
  };

  const deleteRoute = async (id) => {
    if (!window.confirm('Delete this routing rule?')) return;
    try {
      await orgAPI.deleteWebhookRoute(id);
      setRoutes(r => r.filter(x => x.id !== id));
      toast.success('Route deleted');
    } catch { toast.error('Failed to delete route'); }
  };

  if (!canUse) {
    return (
      <div style={{ maxWidth: 560 }}>
        <div style={{ padding: 24, background: 'rgba(245,158,11,0.08)', borderRadius: 12, border: '1px solid rgba(245,158,11,0.25)', textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Webhooks not enabled on your plan</div>
          <div style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            Contact your platform admin to upgrade your plan and enable webhook integrations.
          </div>
        </div>
      </div>
    );
  }

  const subTabs = [
    { id: 'workspaces', label: 'Workspace URLs' },
    { id: 'routing', label: 'Page / Form Routing' },
    { id: 'org', label: 'Org-level URL' },
  ];

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ marginBottom: 20, padding: 13, background: 'rgba(14,165,233,0.07)', borderRadius: 8, fontSize: 13, color: '#0ea5e9', border: '1px solid rgba(14,165,233,0.18)', lineHeight: 1.6 }}>
        Each workspace has its own webhook URL. Use workspace URLs when you can dedicate one Meta App per project. Use Page/Form Routing when one Meta App handles multiple projects.
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
        {subTabs.map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)}
            style={{ padding: '7px 16px', background: 'none', border: 'none', borderBottom: subTab === t.id ? '2px solid var(--accent)' : '2px solid transparent', color: subTab === t.id ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', fontSize: 13, fontWeight: subTab === t.id ? 700 : 400, marginBottom: -1 }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── WORKSPACE URLs ── */}
      {subTab === 'workspaces' && (
        <div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
            Each workspace has a unique token. Create one Meta App per project and paste the matching URL below into that app's webhook configuration.
          </div>
          {loading ? <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading...</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {workspaces.map(ws => (
                <div key={ws.id} style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                  <button onClick={() => setOpenWs(openWs === ws.id ? null : ws.id)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 18px', background: 'var(--surface)', border: 'none', cursor: 'pointer', color: 'var(--text)' }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{ws.name}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{openWs === ws.id ? '▲' : '▼'}</span>
                  </button>
                  {openWs === ws.id && (
                    <div style={{ padding: '4px 18px 18px', borderTop: '1px solid var(--border)' }}>
                      <div style={{ marginTop: 14 }}>
                        <WebhookRow label="Meta / Facebook Webhook URL" url={`${API_BASE}/webhooks/${ws.webhookToken}/meta`} />
                        <WebhookRow label="Verify Token (same for all sources)" url={ws.webhookToken} />
                        <WebhookRow label="Google Ads Webhook URL" url={`${API_BASE}/webhooks/${ws.webhookToken}/google`} />
                        <WebhookRow label="WhatsApp Webhook URL" url={`${API_BASE}/webhooks/${ws.webhookToken}/whatsapp`} />
                        <WebhookRow label="Website / Contact Form URL" url={`${API_BASE}/webhooks/${ws.webhookToken}/website`} />
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {workspaces.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No workspaces found.</div>}
            </div>
          )}
        </div>
      )}

      {/* ── PAGE / FORM ROUTING ── */}
      {subTab === 'routing' && (
        <div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
            When using ONE Meta App for all projects, leads are routed to the correct workspace by matching the Facebook Page ID or Lead Form ID from the payload.
          </div>

          <button onClick={() => setShowAddRoute(s => !s)}
            style={{ marginBottom: 16, padding: '8px 18px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            {showAddRoute ? 'Cancel' : '+ Add Routing Rule'}
          </button>

          {showAddRoute && (
            <form onSubmit={addRoute} style={{ marginBottom: 20, padding: 18, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Match Type</label>
                  <select className="form-control" value={routeForm.matchType} onChange={e => setRouteForm({ ...routeForm, matchType: e.target.value })}>
                    <option value="page_id">Facebook Page ID</option>
                    <option value="form_id">Lead Form ID</option>
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">{routeForm.matchType === 'page_id' ? 'Page ID' : 'Form ID'}</label>
                  <input className="form-control" placeholder={routeForm.matchType === 'page_id' ? 'e.g. 123456789' : 'e.g. 987654321'} value={routeForm.matchValue} onChange={e => setRouteForm({ ...routeForm, matchValue: e.target.value })} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Route to Workspace</label>
                  <select className="form-control" value={routeForm.workspaceId} onChange={e => setRouteForm({ ...routeForm, workspaceId: e.target.value })}>
                    <option value="">Select workspace...</option>
                    {workspaces.map(ws => <option key={ws.id} value={ws.id}>{ws.name}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Label (optional)</label>
                  <input className="form-control" placeholder="e.g. CPR Park Heights Page" value={routeForm.label} onChange={e => setRouteForm({ ...routeForm, label: e.target.value })} />
                </div>
              </div>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Adding...' : 'Add Rule'}</button>
            </form>
          )}

          {loading ? <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading...</div> : (
            routes.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, border: '1px dashed var(--border)', borderRadius: 8 }}>
                No routing rules yet. Add one to route leads by Facebook Page ID or Lead Form ID to a specific workspace.
              </div>
            ) : (
              <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>Label</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>Match</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>Routes To</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>Status</th>
                      <th style={{ padding: '10px 14px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {routes.map((r, i) => (
                      <tr key={r.id} style={{ borderBottom: i < routes.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 500 }}>{r.label || r.matchValue}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ fontSize: 11, padding: '2px 7px', background: r.matchType === 'page_id' ? 'rgba(14,165,233,0.12)' : 'rgba(139,92,246,0.12)', color: r.matchType === 'page_id' ? '#0ea5e9' : '#8b5cf6', borderRadius: 4, marginRight: 6, fontWeight: 600 }}>
                            {r.matchType === 'page_id' ? 'Page ID' : 'Form ID'}
                          </span>
                          <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.matchValue}</span>
                        </td>
                        <td style={{ padding: '10px 14px', color: 'var(--text)' }}>{r.workspace?.name || '—'}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ fontSize: 11, padding: '2px 8px', background: r.isActive ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', color: r.isActive ? '#10b981' : '#ef4444', borderRadius: 4, fontWeight: 600 }}>
                            {r.isActive ? 'Active' : 'Disabled'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                          <button onClick={() => deleteRoute(r.id)} style={{ padding: '4px 10px', fontSize: 12, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 5, cursor: 'pointer' }}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      )}

      {/* ── ORG-LEVEL URL ── */}
      {subTab === 'org' && (
        <div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
            Org-level URL uses Page/Form Routing rules to decide which workspace a lead goes to. If no rule matches, it falls back to your oldest workspace.
          </div>
          <WebhookRow label="Meta / Facebook Org-level URL" url={`${orgBase}/meta`} />
          <WebhookRow label="Org Verify Token" url={orgToken || ''} />
          <WebhookRow label="Google Ads Org-level URL" url={`${orgBase}/google`} />
          <WebhookRow label="WhatsApp Org-level URL" url={`${orgBase}/whatsapp`} />
          <WebhookRow label="Website Org-level URL" url={`${orgBase}/website`} />
        </div>
      )}
    </div>
  );
};

const FormRoutingPanel = ({ integration, workspaces, onRoutesUpdated }) => {
  const [open, setOpen] = useState(false);
  const [forms, setForms] = useState([]);
  const [loadingForms, setLoadingForms] = useState(false);
  const [routes, setRoutes] = useState(integration.formRoutes || []);
  const [newRoute, setNewRoute] = useState({ formId: '', formName: '', workspaceId: '' });
  const [saving, setSaving] = useState(false);

  const loadForms = async () => {
    if (forms.length > 0) return;
    setLoadingForms(true);
    try {
      const { data } = await metaIntegrationAPI.getForms(integration.id);
      setForms(data.forms || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not fetch forms from Meta');
    } finally { setLoadingForms(false); }
  };

  const handleOpen = () => {
    setOpen(s => !s);
    if (!open) loadForms();
  };

  const handleFormSelect = (formId) => {
    const form = forms.find(f => f.id === formId);
    setNewRoute({ formId, formName: form?.name || '', workspaceId: '' });
  };

  const addRoute = async () => {
    if (!newRoute.formId || !newRoute.workspaceId) return toast.error('Select a form and a workspace');
    if (routes.find(r => r.formId === newRoute.formId)) return toast.error('This form already has a routing rule');
    const updated = [...routes, { formId: newRoute.formId, formName: newRoute.formName, workspaceId: parseInt(newRoute.workspaceId) }];
    setSaving(true);
    try {
      await metaIntegrationAPI.updateFormRoutes(integration.id, updated);
      setRoutes(updated);
      setNewRoute({ formId: '', formName: '', workspaceId: '' });
      onRoutesUpdated(integration.id, updated);
      toast.success('Route added');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save route');
    } finally { setSaving(false); }
  };

  const removeRoute = async (formId) => {
    const updated = routes.filter(r => r.formId !== formId);
    setSaving(true);
    try {
      await metaIntegrationAPI.updateFormRoutes(integration.id, updated);
      setRoutes(updated);
      onRoutesUpdated(integration.id, updated);
      toast.success('Route removed');
    } catch { toast.error('Failed to remove route'); }
    finally { setSaving(false); }
  };

  const wsName = (id) => workspaces.find(w => w.id === parseInt(id))?.name || '—';

  return (
    <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
      <button onClick={handleOpen}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 12, fontWeight: 600, padding: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
        {open ? '▲' : '▼'} Form Routing ({routes.length} rule{routes.length !== 1 ? 's' : ''})
      </button>

      {open && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.6 }}>
            Each form routes to a specific workspace. Unmapped forms go to the default workspace: <strong style={{ color: 'var(--text)' }}>{integration.workspace?.name}</strong>.
          </div>

          {routes.length > 0 && (
            <div style={{ marginBottom: 14, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              {routes.map((r, i) => (
                <div key={r.formId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 14px', borderBottom: i < routes.length - 1 ? '1px solid var(--border)' : 'none', fontSize: 13 }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>{r.formName || r.formId}</span>
                    <span style={{ color: 'var(--text-muted)', margin: '0 8px' }}>→</span>
                    <span style={{ color: 'var(--accent)' }}>{wsName(r.workspaceId)}</span>
                  </div>
                  <button onClick={() => removeRoute(r.formId)} disabled={saving}
                    style={{ padding: '3px 9px', fontSize: 11, background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 5, cursor: 'pointer' }}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'end' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: 11 }}>Lead Form</label>
              <select className="form-control" value={newRoute.formId} onChange={e => handleFormSelect(e.target.value)}>
                <option value="">{loadingForms ? 'Loading forms...' : 'Select form...'}</option>
                {forms.filter(f => !routes.find(r => r.formId === f.id)).map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: 11 }}>Route to Workspace</label>
              <select className="form-control" value={newRoute.workspaceId} onChange={e => setNewRoute({ ...newRoute, workspaceId: e.target.value })}>
                <option value="">Select workspace...</option>
                {workspaces.map(ws => <option key={ws.id} value={ws.id}>{ws.name}</option>)}
              </select>
            </div>
            <button onClick={addRoute} disabled={saving || !newRoute.formId || !newRoute.workspaceId}
              style={{ padding: '9px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>
              + Add Rule
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const MetaAdsTab = ({ org }) => {
  const canUse = org?.canUseWebhooks;
  const [integrations, setIntegrations] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showConnect, setShowConnect] = useState(false);
  const [syncing, setSyncing] = useState({});
  const [testing, setTesting] = useState({});
  const [testResults, setTestResults] = useState({});
  const [connectForm, setConnectForm] = useState({ fbPageId: '', fbPageName: '', accessToken: '', workspaceId: '' });
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (!canUse) return;
    Promise.all([metaIntegrationAPI.getAll(), orgAPI.getWebhookWorkspaces()])
      .then(([iRes, wsRes]) => {
        setIntegrations(iRes.data.integrations || []);
        setWorkspaces(wsRes.data.workspaces || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [canUse]);

  const handleConnect = async (e) => {
    e.preventDefault();
    if (!connectForm.fbPageId.trim() || !connectForm.accessToken.trim() || !connectForm.workspaceId) {
      return toast.error('Page ID, Access Token, and Workspace are required');
    }
    setConnecting(true);
    try {
      const { data } = await metaIntegrationAPI.connect({
        fbPageId: connectForm.fbPageId.trim(),
        fbPageName: connectForm.fbPageName.trim() || connectForm.fbPageId.trim(),
        accessToken: connectForm.accessToken.trim(),
        workspaceId: parseInt(connectForm.workspaceId),
      });
      setIntegrations(prev => [data.integration, ...prev]);
      setConnectForm({ fbPageId: '', fbPageName: '', accessToken: '', workspaceId: '' });
      setShowConnect(false);
      toast.success('Facebook page connected');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to connect page');
    } finally { setConnecting(false); }
  };

  const handleSync = async (id) => {
    setSyncing(prev => ({ ...prev, [id]: true }));
    try {
      const { data } = await metaIntegrationAPI.sync(id);
      toast.success(data.message || 'Sync complete');
      setIntegrations(prev => prev.map(i => i.id === id ? { ...i, syncStatus: 'idle', lastSyncAt: new Date().toISOString(), lastSyncError: null } : i));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Sync failed');
      setIntegrations(prev => prev.map(i => i.id === id ? { ...i, syncStatus: 'error' } : i));
    } finally { setSyncing(prev => ({ ...prev, [id]: false })); }
  };

  const handleTestConnection = async (id) => {
    setTesting(prev => ({ ...prev, [id]: true }));
    setTestResults(prev => ({ ...prev, [id]: null }));
    try {
      const { data } = await metaIntegrationAPI.testConnection(id);
      setTestResults(prev => ({ ...prev, [id]: data }));
    } catch (err) {
      setTestResults(prev => ({ ...prev, [id]: { success: false, error: err.response?.data?.message || 'Request failed' } }));
    } finally { setTesting(prev => ({ ...prev, [id]: false })); }
  };

  const handleDisconnect = async (id, name) => {
    if (!window.confirm(`Disconnect "${name}"? Leads already imported will not be deleted.`)) return;
    try {
      await metaIntegrationAPI.disconnect(id);
      setIntegrations(prev => prev.filter(i => i.id !== id));
      toast.success('Page disconnected');
    } catch { toast.error('Failed to disconnect'); }
  };

  const handleRoutesUpdated = (integrationId, formRoutes) => {
    setIntegrations(prev => prev.map(i => i.id === integrationId ? { ...i, formRoutes } : i));
  };

  const statusBadge = (s, err) => {
    if (s === 'syncing') return <span style={{ fontSize: 11, padding: '2px 8px', background: 'rgba(14,165,233,0.12)', color: '#0ea5e9', borderRadius: 4, fontWeight: 600 }}>Syncing...</span>;
    if (s === 'error') return <span title={err || ''} style={{ fontSize: 11, padding: '2px 8px', background: 'rgba(239,68,68,0.12)', color: '#ef4444', borderRadius: 4, fontWeight: 600, cursor: 'help' }}>Error ⚠</span>;
    return <span style={{ fontSize: 11, padding: '2px 8px', background: 'rgba(16,185,129,0.12)', color: '#10b981', borderRadius: 4, fontWeight: 600 }}>Active</span>;
  };

  if (!canUse) {
    return (
      <div style={{ maxWidth: 560 }}>
        <div style={{ padding: 24, background: 'rgba(245,158,11,0.08)', borderRadius: 12, border: '1px solid rgba(245,158,11,0.25)', textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Meta Ads sync requires Growth or Agency plan</div>
          <div style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            Contact your platform admin to upgrade your plan.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ marginBottom: 20, padding: 13, background: 'rgba(14,165,233,0.07)', borderRadius: 8, fontSize: 13, color: '#0ea5e9', border: '1px solid rgba(14,165,233,0.18)', lineHeight: 1.6 }}>
        Connect your Facebook Pages to automatically pull leads every 5 minutes. Use Form Routing to send leads from different ad forms to different workspaces.
      </div>

      <button onClick={() => setShowConnect(s => !s)}
        style={{ marginBottom: 20, padding: '9px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
        {showConnect ? '✕ Cancel' : '+ Connect Facebook Page'}
      </button>

      {showConnect && (
        <form onSubmit={handleConnect} style={{ marginBottom: 24, padding: 20, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>Connect Facebook Page</div>
          <div style={{ marginBottom: 12, padding: 12, background: 'rgba(245,158,11,0.07)', borderRadius: 8, fontSize: 12, color: '#f59e0b', lineHeight: 1.7 }}>
            <strong>How to get a Page Access Token:</strong><br />
            Go to <strong>Meta Business Suite → Settings → Page Access</strong>, or use <strong>Meta Graph API Explorer</strong> → select your page → generate a long-lived token with <code>leads_retrieval</code> permission.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Facebook Page ID *</label>
              <input className="form-control" placeholder="e.g. 123456789012345" value={connectForm.fbPageId} onChange={e => setConnectForm({ ...connectForm, fbPageId: e.target.value })} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Page Name (for display)</label>
              <input className="form-control" placeholder="e.g. CPR Constructions" value={connectForm.fbPageName} onChange={e => setConnectForm({ ...connectForm, fbPageName: e.target.value })} />
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label">Page Access Token *</label>
            <PasswordInput className="form-control" placeholder="Paste your long-lived Page Access Token" value={connectForm.accessToken} onChange={e => setConnectForm({ ...connectForm, accessToken: e.target.value })} style={{ fontFamily: 'monospace', fontSize: 12 }} />
          </div>
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">Default Workspace (catch-all for unmapped forms) *</label>
            <select className="form-control" value={connectForm.workspaceId} onChange={e => setConnectForm({ ...connectForm, workspaceId: e.target.value })}>
              <option value="">Select workspace...</option>
              {workspaces.map(ws => <option key={ws.id} value={ws.id}>{ws.name}</option>)}
            </select>
          </div>
          <button type="submit" className="btn btn-primary" disabled={connecting}>{connecting ? 'Connecting...' : 'Connect Page'}</button>
        </form>
      )}

      {loading ? <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading...</div> : (
        integrations.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, border: '1px dashed var(--border)', borderRadius: 10 }}>
            No Facebook pages connected yet. Click "+ Connect Facebook Page" to get started.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {integrations.map(integration => (
              <div key={integration.id} style={{ padding: '16px 18px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>{integration.fbPageName}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>ID: {integration.fbPageId}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {statusBadge(integration.syncStatus, integration.lastSyncError)}
                    <button onClick={() => handleTestConnection(integration.id)} disabled={testing[integration.id]}
                      style={{ padding: '5px 12px', fontSize: 12, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer' }}>
                      {testing[integration.id] ? 'Testing...' : '🔍 Test Token'}
                    </button>
                    <button onClick={() => handleSync(integration.id)} disabled={syncing[integration.id] || integration.syncStatus === 'syncing'}
                      style={{ padding: '5px 12px', fontSize: 12, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer' }}>
                      {syncing[integration.id] ? 'Syncing...' : '↻ Sync Now'}
                    </button>
                    <button onClick={() => handleDisconnect(integration.id, integration.fbPageName)}
                      style={{ padding: '5px 12px', fontSize: 12, background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, cursor: 'pointer' }}>
                      Disconnect
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 20, fontSize: 12, color: 'var(--text-muted)' }}>
                  <span>Default workspace: <strong style={{ color: 'var(--text)' }}>{integration.workspace?.name || '—'}</strong></span>
                  <span>Last sync: <strong style={{ color: 'var(--text)' }}>{integration.lastSyncAt ? new Date(integration.lastSyncAt).toLocaleString() : 'Never'}</strong></span>
                </div>
                {integration.lastSyncError && (
                  <div style={{ marginTop: 8, padding: '6px 10px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 6, fontSize: 12, color: '#ef4444' }}>
                    {integration.lastSyncError}
                  </div>
                )}
                {testResults[integration.id] && (() => {
                  const r = testResults[integration.id];
                  return r.tokenValid ? (
                    <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 6, fontSize: 12 }}>
                      <strong style={{ color: '#10b981' }}>✓ Token valid</strong>
                      <span style={{ color: 'var(--text-muted)', marginLeft: 12 }}>
                        Page: <strong style={{ color: 'var(--text)' }}>{r.pageName}</strong>
                        {' · '}{r.formCount} form(s)
                        {' · '}<strong style={{ color: 'var(--text)' }}>{r.totalLeadsInMeta}</strong> total leads in Meta
                      </span>
                    </div>
                  ) : (
                    <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 6, fontSize: 12, color: '#ef4444' }}>
                      <strong>✗ Token invalid</strong>
                      {r.error && <span style={{ marginLeft: 8 }}>{r.error}</span>}
                      {r.errorCode && <span style={{ marginLeft: 8, opacity: 0.7 }}>(code: {r.errorCode})</span>}
                    </div>
                  );
                })()}
                <FormRoutingPanel
                  integration={integration}
                  workspaces={workspaces}
                  onRoutesUpdated={handleRoutesUpdated}
                />
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
};

const GoogleAdsTab = ({ org }) => {
  const canUse = org?.canUseWebhooks;
  const API_BASE = process.env.REACT_APP_API_URL || window.location.origin;
  const [workspaces, setWorkspaces] = useState([]);
  const [openWs, setOpenWs] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!canUse) { setLoading(false); return; }
    orgAPI.getWebhookWorkspaces()
      .then(r => setWorkspaces(r.data.workspaces || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [canUse]);

  if (!canUse) {
    return (
      <div style={{ maxWidth: 560 }}>
        <div style={{ padding: 24, background: 'rgba(245,158,11,0.08)', borderRadius: 12, border: '1px solid rgba(245,158,11,0.25)', textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Webhooks not enabled on your plan</div>
          <div style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>Contact your platform admin to upgrade.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ marginBottom: 20, padding: 13, background: 'rgba(66,133,244,0.07)', borderRadius: 8, fontSize: 13, color: '#4285f4', border: '1px solid rgba(66,133,244,0.2)', lineHeight: 1.6 }}>
        Google Ads Lead Form Extensions post leads directly to your webhook URL. Each workspace has its own URL. No OAuth needed — just paste your workspace URL into the Google Ads Lead Form extension webhook field.
      </div>

      <div style={{ marginBottom: 20, padding: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Google Ads Setup Steps</div>
        {[
          ['1', 'In Google Ads, go to Assets → Lead Form Extensions.'],
          ['2', 'Create or edit a lead form. Under "Lead delivery", choose "Webhook".'],
          ['3', 'Paste the Webhook URL below. Leave the Google Key field blank or use your workspace token.'],
          ['4', 'Google will send a GET verification first — the CRM handles it automatically.'],
          ['5', 'Submit the form in Google to test. A new lead will appear in your CRM.'],
        ].map(([n, text]) => (
          <div key={n} style={{ display: 'flex', gap: 10, marginBottom: 8, fontSize: 13 }}>
            <div style={{ minWidth: 22, height: 22, background: '#4285f4', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{n}</div>
            <div style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>{text}</div>
          </div>
        ))}
      </div>

      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Workspace Webhook URLs</div>
      {loading ? <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading...</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {workspaces.map(ws => (
            <div key={ws.id} style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              <button onClick={() => setOpenWs(openWs === ws.id ? null : ws.id)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--surface)', border: 'none', cursor: 'pointer', color: 'var(--text)' }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{ws.name}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{openWs === ws.id ? '▲' : '▼'}</span>
              </button>
              {openWs === ws.id && (
                <div style={{ padding: '4px 16px 16px', borderTop: '1px solid var(--border)' }}>
                  <div style={{ marginTop: 12 }}>
                    <WebhookRow label="Google Ads Webhook URL (paste this in Google Ads)" url={`${API_BASE}/webhooks/${ws.webhookToken}/google`} />
                    <WebhookRow label="Verify Token (if Google asks)" url={ws.webhookToken} />
                  </div>
                </div>
              )}
            </div>
          ))}
          {workspaces.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No workspaces found.</div>}
        </div>
      )}

      <div style={{ marginTop: 24, padding: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Expected Payload Format</div>
        <pre style={{ fontSize: 11, color: '#a0a0c0', background: '#0a0a17', padding: 12, borderRadius: 6, overflow: 'auto', lineHeight: 1.6, margin: 0 }}>{`{
  "lead_id": "TeSter-123",
  "user_column_data": [
    {"column_id": "FULL_NAME", "string_value": "Ravi Kumar"},
    {"column_id": "PHONE_NUMBER", "string_value": "+919876543210"},
    {"column_id": "EMAIL", "string_value": "ravi@example.com"}
  ],
  "campaign_name": "Summer Campaign",
  "lead_form_name": "Real Estate Inquiry",
  "gclid": "abc123"
}`}</pre>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Also supports flat format: <code style={{ background: '#0a0a17', padding: '2px 5px', borderRadius: 3 }}>{"{ name, phone, email, campaign_name }"}</code></div>
      </div>
    </div>
  );
};

const WebsiteLeadsTab = ({ org }) => {
  const canUse = org?.canUseWebhooks;
  const API_BASE = process.env.REACT_APP_API_URL || window.location.origin;
  const [workspaces, setWorkspaces] = useState([]);
  const [selectedWs, setSelectedWs] = useState('');
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testForm, setTestForm] = useState({ name: '', phone: '', email: '' });

  useEffect(() => {
    if (!canUse) { setLoading(false); return; }
    orgAPI.getWebhookWorkspaces()
      .then(r => {
        const ws = r.data.workspaces || [];
        setWorkspaces(ws);
        if (ws.length > 0) setSelectedWs(ws[0].webhookToken);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [canUse]);

  const selectedWorkspace = workspaces.find(w => w.webhookToken === selectedWs);
  const webhookUrl = selectedWs ? `${API_BASE}/webhooks/${selectedWs}/website` : '';

  const handleTest = async (e) => {
    e.preventDefault();
    if (!webhookUrl) return;
    setTesting(true);
    try {
      const resp = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testForm),
      });
      const data = await resp.json();
      if (data.success) toast.success(data.isDuplicate ? 'Duplicate lead detected (already exists)' : 'Test lead created successfully!');
      else toast.error(data.error || 'Test failed');
    } catch (err) {
      toast.error('Test failed: ' + err.message);
    } finally { setTesting(false); }
  };

  if (!canUse) {
    return (
      <div style={{ maxWidth: 560 }}>
        <div style={{ padding: 24, background: 'rgba(245,158,11,0.08)', borderRadius: 12, border: '1px solid rgba(245,158,11,0.25)', textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Webhooks not enabled on your plan</div>
          <div style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>Contact your platform admin to upgrade.</div>
        </div>
      </div>
    );
  }

  const jsSnippet = webhookUrl ? `// Paste this script in your website's <head> or before </body>
fetch('${webhookUrl}', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: formData.name,
    phone: formData.phone,
    email: formData.email,
    source: 'Contact Form'
  })
});` : '// Select a workspace above to see the snippet';

  const htmlSnippet = webhookUrl ? `<!-- Simple HTML form that submits to CRM -->
<form id="crmForm">
  <input name="name" placeholder="Full Name" required />
  <input name="phone" placeholder="Phone Number" required />
  <input name="email" placeholder="Email" type="email" />
  <button type="submit">Submit</button>
</form>
<script>
document.getElementById('crmForm').addEventListener('submit', function(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  fetch('${webhookUrl}', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.fromEntries(fd))
  }).then(() => alert('Thank you! We will contact you soon.'));
});
</script>` : '<!-- Select a workspace above -->';

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ marginBottom: 20, padding: 13, background: 'rgba(16,185,129,0.07)', borderRadius: 8, fontSize: 13, color: '#10b981', border: '1px solid rgba(16,185,129,0.2)', lineHeight: 1.6 }}>
        Send leads from your website contact form directly into the CRM. Just POST to your workspace URL — no auth required. Works with any website or landing page.
      </div>

      {loading ? <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading...</div> : (
        <>
          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="form-label">Select Workspace</label>
            <select className="form-control" style={{ maxWidth: 340 }} value={selectedWs} onChange={e => setSelectedWs(e.target.value)}>
              {workspaces.map(ws => <option key={ws.id} value={ws.webhookToken}>{ws.name}</option>)}
            </select>
          </div>

          {selectedWs && (
            <>
              <WebhookRow label={`Website Webhook URL (${selectedWorkspace?.name})`} url={webhookUrl} />

              <div style={{ marginBottom: 20, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 13 }}>HTML Form + JavaScript Snippet</div>
                <pre style={{ fontSize: 11, color: '#a0a0c0', padding: 16, overflow: 'auto', lineHeight: 1.6, margin: 0, background: '#0a0a17' }}>{htmlSnippet}</pre>
                <button onClick={() => { navigator.clipboard.writeText(htmlSnippet); toast.success('Copied!'); }}
                  style={{ margin: 12, padding: '6px 14px', fontSize: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', cursor: 'pointer' }}>
                  Copy HTML Snippet
                </button>
              </div>

              <div style={{ marginBottom: 20, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 13 }}>JavaScript Only (for existing forms)</div>
                <pre style={{ fontSize: 11, color: '#a0a0c0', padding: 16, overflow: 'auto', lineHeight: 1.6, margin: 0, background: '#0a0a17' }}>{jsSnippet}</pre>
                <button onClick={() => { navigator.clipboard.writeText(jsSnippet); toast.success('Copied!'); }}
                  style={{ margin: 12, padding: '6px 14px', fontSize: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', cursor: 'pointer' }}>
                  Copy JS Snippet
                </button>
              </div>

              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Test Your Webhook</div>
                <form onSubmit={handleTest}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Name *</label>
                      <input className="form-control" placeholder="Test Lead" value={testForm.name} onChange={e => setTestForm({ ...testForm, name: e.target.value })} required />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Phone *</label>
                      <input className="form-control" placeholder="9876543210" value={testForm.phone} onChange={e => setTestForm({ ...testForm, phone: e.target.value.replace(/[^0-9+]/g, '') })} required />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Email</label>
                      <input className="form-control" type="email" placeholder="test@example.com" value={testForm.email} onChange={e => setTestForm({ ...testForm, email: e.target.value })} />
                    </div>
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={testing}>{testing ? 'Sending...' : 'Send Test Lead'}</button>
                </form>
              </div>

              <div style={{ marginTop: 16, padding: 14, background: 'rgba(14,165,233,0.07)', borderRadius: 8, fontSize: 12, color: '#0ea5e9', border: '1px solid rgba(14,165,233,0.15)', lineHeight: 1.7 }}>
                <strong>Accepted fields:</strong> <code>name</code>, <code>phone</code>, <code>email</code>, <code>source</code> (optional label), <code>campaign</code> — any extra fields are stored in the lead's metadata.
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

const Settings = () => {
  const { org, isRole, refreshUser, user } = useAuth();
  const [tab, setTab] = useState(isRole('owner') ? 'org' : 'workspace');
  const [saving, setSaving] = useState(false);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);

  const [wsForm, setWsForm] = useState({ name: '', description: '' });
  const [orgSettings, setOrgSettings] = useState({ companyName: '', companyAddress: '', companyPhone: '', companyEmail: '', companyGST: '', companyWebsite: '', logoUrl: '' });
  const [smtpForm, setSmtpForm] = useState({ host: '', port: 587, user: '', pass: '', from: '', secure: false });
  const [testEmail, setTestEmail] = useState('');

  useEffect(() => {
    workspaceAPI.get().then(({ data }) => {
      setWsForm({ name: data.workspace?.name || data.name || '', description: data.workspace?.description || data.description || '' });
    }).catch(() => {});

    if (org?.settings) {
      const s = typeof org.settings === 'string' ? JSON.parse(org.settings) : org.settings;
      const b = s.branding || {};
      setOrgSettings({
        companyName: b.companyName || org.name || '',
        companyAddress: b.address || '',
        companyPhone: b.phone || '',
        companyEmail: b.email || '',
        companyGST: b.gst || '',
        companyWebsite: b.website || '',
        logoUrl: b.logo || '',
      });
      if (s.smtp) {
        setSmtpForm({ host: s.smtp.host || '', port: s.smtp.port || 587, user: s.smtp.user || '', pass: '', from: s.smtp.from || '', secure: s.smtp.secure || false });
      }
    }
  }, [org]);

  const saveWorkspace = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await workspaceAPI.update(wsForm);
      toast.success('Workspace updated');
    } catch { toast.error('Failed to save workspace'); }
    finally { setSaving(false); }
  };

  const saveOrgSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const current = typeof org?.settings === 'string' ? JSON.parse(org.settings || '{}') : (org?.settings || {});
      await orgAPI.updateSettings({
        settings: {
          ...current,
          branding: {
            companyName: orgSettings.companyName,
            address: orgSettings.companyAddress,
            phone: orgSettings.companyPhone,
            email: orgSettings.companyEmail,
            gst: orgSettings.companyGST,
            website: orgSettings.companyWebsite,
            logo: orgSettings.logoUrl,
          },
        },
      });
      toast.success('Organization settings saved');
      await refreshUser();
    } catch { toast.error('Failed to save settings'); }
    finally { setSaving(false); }
  };

  const saveSMTP = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const current = typeof org?.settings === 'string' ? JSON.parse(org.settings || '{}') : (org?.settings || {});
      const smtp = { host: smtpForm.host, port: parseInt(smtpForm.port), user: smtpForm.user, from: smtpForm.from, secure: smtpForm.secure };
      if (smtpForm.pass) smtp.pass = smtpForm.pass;
      await orgAPI.updateSettings({ settings: { ...current, smtp } });
      toast.success('SMTP settings saved');
      await refreshUser();
    } catch { toast.error('Failed to save SMTP settings'); }
    finally { setSaving(false); }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirm) return toast.error('Passwords do not match');
    if (pwForm.newPassword.length < 8) return toast.error('Password must be at least 8 characters');
    setPwSaving(true);
    try {
      await authAPI.changePassword({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
      toast.success('Password changed successfully');
      setPwForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally { setPwSaving(false); }
  };

  const tabs = isRole('owner')
    ? [
        { id: 'org', label: 'Organization' },
        { id: 'smtp', label: 'Email (SMTP)' },
        { id: 'webhooks', label: 'Webhooks' },
        { id: 'meta', label: 'Meta Ads' },
        { id: 'google', label: 'Google Ads' },
        { id: 'website', label: 'Website Leads' },
        { id: 'password', label: 'Change Password' },
      ]
    : user?.role === 'employee'
    ? [{ id: 'workspace', label: 'Workspace' }]
    : [
        { id: 'workspace', label: 'Workspace' },
        { id: 'password', label: 'Change Password' },
      ];

  return (
    <Layout title="Settings">
      <div className="page-header"><div className="page-title">Settings</div></div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: '8px 18px', background: 'none', border: 'none', borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent', color: tab === t.id ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', fontSize: 14, fontWeight: tab === t.id ? 700 : 400, marginBottom: -1, transition: 'all 0.2s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'workspace' && (
        <div style={{ maxWidth: 540 }}>
          <form onSubmit={saveWorkspace}>
            <div className="form-group"><label className="form-label">Workspace Name</label><input className="form-control" value={wsForm.name} onChange={e => setWsForm({ ...wsForm, name: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Description</label><textarea className="form-control" rows={3} value={wsForm.description} onChange={e => setWsForm({ ...wsForm, description: e.target.value })} placeholder="Brief description of this workspace..." /></div>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Workspace'}</button>
          </form>
        </div>
      )}

      {tab === 'org' && (
        <div style={{ maxWidth: 600 }}>
          <div style={{ marginBottom: 20, padding: 14, background: 'rgba(14,165,233,0.08)', borderRadius: 8, fontSize: 13, color: '#0ea5e9', border: '1px solid rgba(14,165,233,0.2)' }}>
            These details appear on your PDF Quotations and Invoices.
          </div>
          <form onSubmit={saveOrgSettings}>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Company Name</label><input className="form-control" value={orgSettings.companyName} onChange={e => setOrgSettings({ ...orgSettings, companyName: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">GST Number</label><input className="form-control" value={orgSettings.companyGST} onChange={e => setOrgSettings({ ...orgSettings, companyGST: e.target.value })} placeholder="22AAAAA0000A1Z5" /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Phone</label><input className="form-control" value={orgSettings.companyPhone} onChange={e => setOrgSettings({ ...orgSettings, companyPhone: e.target.value.replace(/[^0-9+]/g, '') })} placeholder="+91 9876543210" /></div>
              <div className="form-group"><label className="form-label">Email</label><input className="form-control" type="email" value={orgSettings.companyEmail} onChange={e => setOrgSettings({ ...orgSettings, companyEmail: e.target.value })} /></div>
            </div>
            <div className="form-group"><label className="form-label">Website</label><input className="form-control" value={orgSettings.companyWebsite} onChange={e => setOrgSettings({ ...orgSettings, companyWebsite: e.target.value })} placeholder="https://yourwebsite.com" /></div>
            <div className="form-group"><label className="form-label">Address</label><textarea className="form-control" rows={2} value={orgSettings.companyAddress} onChange={e => setOrgSettings({ ...orgSettings, companyAddress: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Logo URL</label><input className="form-control" value={orgSettings.logoUrl} onChange={e => setOrgSettings({ ...orgSettings, logoUrl: e.target.value })} placeholder="https://..." /></div>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Organization Info'}</button>
          </form>
        </div>
      )}

      {tab === 'webhooks' && (
        <WebhooksTab org={org} />
      )}

      {tab === 'meta' && (
        <MetaAdsTab org={org} />
      )}

      {tab === 'google' && (
        <GoogleAdsTab org={org} />
      )}

      {tab === 'website' && (
        <WebsiteLeadsTab org={org} />
      )}

      {tab === 'password' && (
        <div style={{ maxWidth: 440 }}>
          <div style={{ marginBottom: 20, padding: 13, background: 'rgba(239,68,68,0.07)', borderRadius: 8, fontSize: 13, color: '#ef4444', border: '1px solid rgba(239,68,68,0.18)', lineHeight: 1.6 }}>
            Choose a strong password with at least 8 characters.
          </div>
          <form onSubmit={handleChangePassword}>
            <div className="form-group">
              <label className="form-label">Current Password</label>
              <PasswordInput className="form-control" placeholder="Your current password" value={pwForm.currentPassword} onChange={e => setPwForm({ ...pwForm, currentPassword: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">New Password</label>
              <PasswordInput className="form-control" placeholder="Min. 8 characters" value={pwForm.newPassword} onChange={e => setPwForm({ ...pwForm, newPassword: e.target.value })} required minLength={8} />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm New Password</label>
              <PasswordInput className="form-control" placeholder="Repeat new password" value={pwForm.confirm} onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })} required />
            </div>
            <button type="submit" className="btn btn-primary" disabled={pwSaving}>{pwSaving ? 'Changing...' : 'Change Password'}</button>
          </form>
        </div>
      )}

      {tab === 'smtp' && (
        <div style={{ maxWidth: 540 }}>
          <div style={{ marginBottom: 20, padding: 14, background: 'rgba(245,158,11,0.08)', borderRadius: 8, fontSize: 13, color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}>
            Configure your own SMTP server to send emails from your domain. Leave blank to use the platform default.
          </div>
          <form onSubmit={saveSMTP}>
            <div className="form-row">
              <div className="form-group"><label className="form-label">SMTP Host</label><input className="form-control" value={smtpForm.host} onChange={e => setSmtpForm({ ...smtpForm, host: e.target.value })} placeholder="smtp.gmail.com" /></div>
              <div className="form-group"><label className="form-label">Port</label><input className="form-control" type="number" value={smtpForm.port} onChange={e => setSmtpForm({ ...smtpForm, port: e.target.value })} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Username</label><input className="form-control" value={smtpForm.user} onChange={e => setSmtpForm({ ...smtpForm, user: e.target.value })} placeholder="you@yourdomain.com" /></div>
              <div className="form-group"><label className="form-label">Password {smtpForm.host && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(leave blank to keep)</span>}</label><PasswordInput className="form-control" value={smtpForm.pass} onChange={e => setSmtpForm({ ...smtpForm, pass: e.target.value })} placeholder="App password or SMTP password" /></div>
            </div>
            <div className="form-group"><label className="form-label">From Address</label><input className="form-control" value={smtpForm.from} onChange={e => setSmtpForm({ ...smtpForm, from: e.target.value })} placeholder="CRM Name <noreply@yourdomain.com>" /></div>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                <input type="checkbox" checked={smtpForm.secure} onChange={e => setSmtpForm({ ...smtpForm, secure: e.target.checked })} />
                Use SSL/TLS (port 465)
              </label>
            </div>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save SMTP Settings'}</button>
          </form>
        </div>
      )}
    </Layout>
  );
};

export default Settings;
