import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || '';

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

const Pricing = () => {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [billing, setBilling] = useState('monthly');
  const hasYearly = plans.some(p => Number(p.yearlyPrice) > 0);

  useEffect(() => {
    axios.get(`${API_URL}/api/public/plans`)
      .then(({ data }) => setPlans(data.plans || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={s.page}>
      {/* Top Nav */}
      <div style={s.nav}>
        <div style={s.navBrand}>
          <div style={s.logoIcon}>CRM</div>
          <span style={s.logoText}>Agency CRM</span>
        </div>
        <div style={s.navActions}>
          <button style={s.navLink} onClick={() => navigate('/login')}>Login</button>
          <button style={s.registerBtn} onClick={() => navigate('/register')}>Register</button>
        </div>
      </div>

      {/* Hero */}
      <div style={s.hero}>
        <h1 style={s.heroTitle}>Simple, Transparent Pricing</h1>
        <p style={s.heroSub}>Choose the plan that fits your agency. No hidden fees.</p>
        {hasYearly && (
          <div style={s.toggle}>
            <button style={{ ...s.toggleBtn, ...(billing === 'monthly' ? s.toggleActive : {}) }} onClick={() => setBilling('monthly')}>Monthly</button>
            <button style={{ ...s.toggleBtn, ...(billing === 'yearly' ? s.toggleActive : {}) }} onClick={() => setBilling('yearly')}>
              Yearly <span style={s.saveBadge}>Save more</span>
            </button>
          </div>
        )}
      </div>

      {/* Plans */}
      {loading ? (
        <div style={s.spinnerWrap}><div style={s.spinner} /></div>
      ) : (
        <div style={s.grid}>
          {plans.map((plan, i) => {
            const isPopular = i === Math.floor(plans.length / 2);
            return (
              <div key={plan.id} style={{ ...s.card, ...(isPopular ? s.cardPopular : {}) }}>
                {isPopular && <div style={s.popularBadge}>Most Popular</div>}
                <div style={s.planName}>{plan.displayName || plan.name}</div>
                <div style={s.planPrice}>
                  {plan.price === 0 || plan.price === '0.00'
                    ? <span style={s.priceNum}>Free</span>
                    : billing === 'yearly' && Number(plan.yearlyPrice) > 0
                      ? <><span style={s.priceNum}>₹{Number(plan.yearlyPrice).toLocaleString('en-IN')}</span><span style={s.pricePer}>/yr</span></>
                      : <><span style={s.priceNum}>₹{Number(plan.price).toLocaleString('en-IN')}</span><span style={s.pricePer}>/mo</span></>
                  }
                </div>
                {billing === 'yearly' && Number(plan.yearlyPrice) > 0 && (
                  <div style={{ fontSize: 12, color: '#22c55e', marginBottom: 4 }}>
                    vs ₹{(Number(plan.price) * 12).toLocaleString('en-IN')}/yr monthly — save ₹{(Number(plan.price) * 12 - Number(plan.yearlyPrice)).toLocaleString('en-IN')}
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
                  style={{ ...s.getStartedBtn, ...(isPopular ? s.getStartedBtnPopular : {}) }}
                  onClick={() => navigate(`/register?plan=${plan.id}&billing=${billing}`)}
                >
                  Get Started
                </button>
              </div>
            );
          })}
        </div>
      )}

      <p style={s.footer}>
        Have questions? <span style={s.footerLink} onClick={() => navigate('/register')}>Contact us on WhatsApp</span>
      </p>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

const s = {
  page: { minHeight: '100vh', background: '#0d0d1a', color: '#e2e2f0', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', paddingBottom: 60 },
  nav: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 32px', borderBottom: '1px solid #1e1e3a', position: 'sticky', top: 0, background: '#0d0d1a', zIndex: 10 },
  navBrand: { display: 'flex', alignItems: 'center', gap: 10 },
  logoIcon: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, background: 'linear-gradient(135deg, #e94560, #7c3aed)', borderRadius: 9, fontSize: 12, fontWeight: 700, color: '#fff' },
  logoText: { fontSize: 16, fontWeight: 700, color: '#e2e2f0' },
  navActions: { display: 'flex', alignItems: 'center', gap: 12 },
  navLink: { background: 'none', border: 'none', color: '#9ca3af', fontSize: 14, cursor: 'pointer', padding: '8px 14px', borderRadius: 8 },
  registerBtn: { background: 'linear-gradient(135deg, #e94560, #7c3aed)', border: 'none', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: '8px 18px', borderRadius: 8 },
  hero: { textAlign: 'center', padding: '60px 20px 40px' },
  toggle: { display: 'inline-flex', background: '#12121f', border: '1px solid #1e1e3a', borderRadius: 30, padding: 4, marginTop: 24, gap: 4 },
  toggleBtn: { background: 'none', border: 'none', color: '#9ca3af', fontSize: 14, fontWeight: 500, padding: '8px 20px', borderRadius: 26, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 },
  toggleActive: { background: 'linear-gradient(135deg, #e94560, #7c3aed)', color: '#fff' },
  saveBadge: { fontSize: 10, background: 'rgba(34,197,94,0.2)', color: '#22c55e', padding: '2px 7px', borderRadius: 20, fontWeight: 700 },
  heroTitle: { fontSize: 36, fontWeight: 800, margin: '0 0 12px', background: 'linear-gradient(135deg, #e2e2f0, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  heroSub: { fontSize: 16, color: '#9ca3af', margin: 0 },
  spinnerWrap: { display: 'flex', justifyContent: 'center', padding: 60 },
  spinner: { width: 40, height: 40, border: '3px solid #1e1e3a', borderTopColor: '#e94560', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, maxWidth: 1400, margin: '0 auto', padding: '0 24px' },
  card: { background: '#12121f', border: '1px solid #1e1e3a', borderRadius: 16, padding: '24px 20px', position: 'relative', display: 'flex', flexDirection: 'column', gap: 0 },
  cardPopular: { border: '1.5px solid #7c3aed', boxShadow: '0 0 32px rgba(124,58,237,0.15)' },
  popularBadge: { position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg, #e94560, #7c3aed)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '4px 14px', borderRadius: 20, whiteSpace: 'nowrap' },
  planName: { fontSize: 20, fontWeight: 700, textTransform: 'capitalize', marginBottom: 8 },
  planPrice: { marginBottom: 12 },
  priceNum: { fontSize: 28, fontWeight: 800, color: '#e94560' },
  pricePer: { fontSize: 14, color: '#9ca3af', marginLeft: 4 },
  planDesc: { fontSize: 13, color: '#9ca3af', marginBottom: 16, lineHeight: 1.5 },
  limits: { marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 },
  limitRow: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#d1d5db' },
  limitIcon: { fontSize: 14 },
  features: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24, paddingTop: 16, borderTop: '1px solid #1e1e3a' },
  featureRow: { display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 },
  featureDot: { width: 18, height: 18, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff', flexShrink: 0 },
  getStartedBtn: { marginTop: 'auto', width: '100%', padding: '12px', borderRadius: 10, border: '1px solid #2a2a4a', background: 'transparent', color: '#e2e2f0', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  getStartedBtnPopular: { background: 'linear-gradient(135deg, #e94560, #7c3aed)', border: 'none', color: '#fff' },
  footer: { textAlign: 'center', marginTop: 48, fontSize: 14, color: '#6b7280' },
  footerLink: { color: '#a78bfa', cursor: 'pointer', textDecoration: 'underline' },
};

export default Pricing;
