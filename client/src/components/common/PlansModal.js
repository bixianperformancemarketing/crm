import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || '';
const COMPANY_PHONE = process.env.REACT_APP_COMPANY_PHONE || '+91 98765 43210';
const COMPANY_EMAIL = process.env.REACT_APP_COMPANY_EMAIL || 'hello@yourcompany.com';

const FEATURE_LABELS = {
  canUseQuotations: 'Quotations',
  canUseInvoices: 'Invoices',
  canUseAppointments: 'Appointments',
  canUsePDF: 'PDF / Email / WhatsApp',
  canUseCSVImport: 'CSV Import',
  canUseContentCalendar: 'Tasks',
  canUseAdvancedReports: 'Advanced Reports',
  canUseWebhooks: 'Webhooks & Lead Integrations',
};

const CYCLES = [
  { key: 'monthly',    label: 'Monthly',     field: 'price',           per: '/mo'  },
  { key: 'quarterly',  label: 'Quarterly',   field: 'quarterlyPrice',  per: '/qtr' },
  { key: 'halfYearly', label: 'Half-Yearly', field: 'halfYearlyPrice', per: '/6mo' },
  { key: 'yearly',     label: 'Yearly',      field: 'yearlyPrice',     per: '/yr'  },
];

const withGST = (val) => Math.round(Number(val) * 1.18);

const PlansModal = ({ onClose }) => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [billing, setBilling] = useState('monthly');

  useEffect(() => {
    axios.get(`${API_URL}/api/public/plans`)
      .then(({ data }) => setPlans(data.plans || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const availableCycles = CYCLES.filter(c =>
    c.key === 'monthly' || plans.some(p => Number(p[c.field]) > 0)
  );

  const activeCycle = CYCLES.find(c => c.key === billing);

  const getPrice = (plan, cycle) =>
    cycle.key === 'monthly' ? plan.price : plan[cycle.field];

  const getSaving = (plan, cycle) => {
    if (cycle.key === 'monthly') return null;
    const months = cycle.key === 'quarterly' ? 3 : cycle.key === 'halfYearly' ? 6 : 12;
    const monthlyTotal = withGST(plan.price) * months;
    const cyclePrice = withGST(plan[cycle.field]);
    if (!cyclePrice || !monthlyTotal) return null;
    const saved = monthlyTotal - cyclePrice;
    if (saved <= 0) return null;
    return { saved, pct: Math.round((saved / monthlyTotal) * 100) };
  };

  const handleSelectPlan = (plan) => {
    const msg = encodeURIComponent(`Hi! I would like to renew my CRM subscription with the "${plan.displayName || plan.name}" plan. Please help.`);
    window.open(`https://wa.me/${COMPANY_PHONE.replace(/\D/g, '')}?text=${msg}`, '_blank');
  };

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <button style={s.closeBtn} onClick={onClose}>×</button>

        <div style={s.header}>
          <div style={s.title}>Subscription Plans</div>
          <div style={s.sub}>Choose a plan to renew. We'll get you set up right away.</div>
          {availableCycles.length > 1 && (
            <div style={s.toggle}>
              {availableCycles.map(c => (
                <button
                  key={c.key}
                  style={{ ...s.toggleBtn, ...(billing === c.key ? s.toggleActive : {}) }}
                  onClick={() => setBilling(c.key)}
                >
                  {c.label}
                  {c.key !== 'monthly' && plans.some(p => getSaving(p, c)) && (
                    <span style={s.saveBadge}>Save more</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <div style={s.spinnerWrap}><div style={s.spinner} /></div>
        ) : (
          <div style={s.grid}>
            {plans.map((plan, i) => {
              const isPopular = i === Math.floor(plans.length / 2);
              const price = getPrice(plan, activeCycle);
              const saving = getSaving(plan, activeCycle);
              return (
                <div key={plan.id} style={{ ...s.card, ...(isPopular ? s.cardPopular : {}) }}>
                  {isPopular && <div style={s.popularBadge}>Most Popular</div>}
                  <div style={s.planName}>{plan.displayName || plan.name}</div>
                  <div style={s.planPrice}>
                    {plan.price === 0 || plan.price === '0.00'
                      ? <span style={s.priceNum}>Free</span>
                      : Number(price) > 0
                        ? <><span style={s.priceNum}>₹{withGST(price).toLocaleString('en-IN')}</span><span style={s.pricePer}>{activeCycle.per}</span></>
                        : <><span style={s.priceNum}>₹{withGST(plan.price).toLocaleString('en-IN')}</span><span style={s.pricePer}>/mo</span></>
                    }
                  </div>
                  {plan.price !== 0 && plan.price !== '0.00' && (
                    <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>incl. 18% GST</div>
                  )}
                  {saving && (
                    <div style={{ fontSize: 12, color: '#22c55e', marginBottom: 4 }}>
                      Save ₹{saving.saved.toLocaleString('en-IN')} ({saving.pct}% off vs monthly)
                    </div>
                  )}
                  {plan.description && <p style={s.planDesc}>{plan.description}</p>}

                  <div style={s.limits}>
                    <div style={s.limitRow}><span style={s.limitIcon}>👥</span>{plan.maxUsersPerWorkspace} users per workspace</div>
                    <div style={s.limitRow}><span style={s.limitIcon}>🎯</span>{plan.maxLeadsTotal} leads total</div>
                    <div style={s.limitRow}><span style={s.limitIcon}>📁</span>{plan.maxWorkspaces} workspace{plan.maxWorkspaces > 1 ? 's' : ''}</div>
                    <div style={s.limitRow}><span style={s.limitIcon}>📅</span>{plan.durationDays} days validity</div>
                  </div>

                  <div style={s.features}>
                    {Object.entries(FEATURE_LABELS).map(([key, label]) => (
                      <div key={key} style={s.featureRow}>
                        <span style={{ ...s.featureDot, background: plan[key] ? '#22c55e' : '#374151' }}>
                          {plan[key] ? '✓' : '✗'}
                        </span>
                        <span style={{ color: plan[key] ? '#e2e2f0' : '#6b7280' }}>{label}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    style={{ ...s.selectBtn, ...(isPopular ? s.selectBtnPopular : {}) }}
                    onClick={() => handleSelectPlan(plan)}
                  >
                    📱 Renew with this Plan
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div style={s.footer}>
          Questions? &nbsp;
          <a href={`mailto:${COMPANY_EMAIL}`} style={s.footerLink}>Email us</a>
          &nbsp;or&nbsp;
          <a href={`https://wa.me/${COMPANY_PHONE.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" style={s.footerLink}>Chat on WhatsApp</a>
        </div>

        <style>{`
          @keyframes pmSpin { to { transform: rotate(360deg); } }
          @keyframes pmFadeIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
          .pm-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
          @media (max-width: 1100px) { .pm-grid { grid-template-columns: repeat(2, 1fr); } }
          @media (max-width: 640px) { .pm-grid { grid-template-columns: 1fr; } }
        `}</style>
      </div>
    </div>
  );
};

const s = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 16px', overflowY: 'auto' },
  modal: { background: '#0d0d1a', border: '1px solid #1e1e3a', borderRadius: 16, width: '100%', maxWidth: 1200, position: 'relative', padding: '32px 28px 28px', animation: 'pmFadeIn 0.2s ease' },
  closeBtn: { position: 'absolute', top: 14, right: 18, background: 'none', border: 'none', color: '#9ca3af', fontSize: 26, cursor: 'pointer', lineHeight: 1, padding: '2px 6px', borderRadius: 6 },
  header: { textAlign: 'center', marginBottom: 28 },
  title: { fontSize: 26, fontWeight: 800, background: 'linear-gradient(135deg, #e2e2f0, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 6 },
  sub: { fontSize: 14, color: '#9ca3af', marginBottom: 16 },
  toggle: { display: 'inline-flex', background: '#12121f', border: '1px solid #1e1e3a', borderRadius: 30, padding: 4, gap: 4, flexWrap: 'wrap', justifyContent: 'center' },
  toggleBtn: { background: 'none', border: 'none', color: '#9ca3af', fontSize: 13, fontWeight: 500, padding: '7px 18px', borderRadius: 26, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 },
  toggleActive: { background: 'linear-gradient(135deg, #e94560, #7c3aed)', color: '#fff' },
  saveBadge: { fontSize: 10, background: 'rgba(34,197,94,0.2)', color: '#22c55e', padding: '2px 7px', borderRadius: 20, fontWeight: 700 },
  spinnerWrap: { display: 'flex', justifyContent: 'center', padding: 60 },
  spinner: { width: 36, height: 36, border: '3px solid #1e1e3a', borderTopColor: '#e94560', borderRadius: '50%', animation: 'pmSpin 0.8s linear infinite' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 },
  card: { background: '#12121f', border: '1px solid #1e1e3a', borderRadius: 14, padding: '22px 18px', position: 'relative', display: 'flex', flexDirection: 'column' },
  cardPopular: { border: '1.5px solid #7c3aed', boxShadow: '0 0 28px rgba(124,58,237,0.15)' },
  popularBadge: { position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg, #e94560, #7c3aed)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 12px', borderRadius: 20, whiteSpace: 'nowrap' },
  planName: { fontSize: 18, fontWeight: 700, textTransform: 'capitalize', marginBottom: 8, color: '#e2e2f0' },
  planPrice: { marginBottom: 10 },
  priceNum: { fontSize: 26, fontWeight: 800, color: '#e94560' },
  pricePer: { fontSize: 13, color: '#9ca3af', marginLeft: 3 },
  planDesc: { fontSize: 12, color: '#9ca3af', marginBottom: 14, lineHeight: 1.5 },
  limits: { marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 7 },
  limitRow: { display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#d1d5db' },
  limitIcon: { fontSize: 13 },
  features: { display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 20, paddingTop: 14, borderTop: '1px solid #1e1e3a' },
  featureRow: { display: 'flex', alignItems: 'center', gap: 9, fontSize: 12 },
  featureDot: { width: 16, height: 16, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#fff', flexShrink: 0 },
  selectBtn: { marginTop: 'auto', width: '100%', padding: '11px', borderRadius: 9, border: '1px solid #2a2a4a', background: 'transparent', color: '#e2e2f0', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  selectBtnPopular: { background: 'linear-gradient(135deg, #e94560, #7c3aed)', border: 'none', color: '#fff' },
  footer: { textAlign: 'center', fontSize: 13, color: '#6b7280', paddingTop: 16, borderTop: '1px solid #1e1e3a' },
  footerLink: { color: '#a78bfa', textDecoration: 'underline', cursor: 'pointer' },
};

export default PlansModal;
