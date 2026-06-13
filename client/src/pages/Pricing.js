import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import BixianLogo from '../assets/logo/BixianLogo.png';

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

const CYCLES = [
  { key: 'monthly',    label: 'Monthly',     field: 'price',          per: '/mo'  },
  { key: 'quarterly',  label: 'Quarterly',   field: 'quarterlyPrice', per: '/qtr' },
  { key: 'halfYearly', label: 'Half-Yearly', field: 'halfYearlyPrice',per: '/6mo' },
  { key: 'yearly',     label: 'Yearly',      field: 'yearlyPrice',    per: '/yr'  },
];

const Pricing = () => {
  const navigate = useNavigate();
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

    const withGST = (val) => Math.round(Number(val) * 1.18);

  const getPrice = (plan, cycle) => {
    if (cycle.key === 'monthly') return plan.price;
    return plan[cycle.field];
  };

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

  const activeCycle = CYCLES.find(c => c.key === billing);

  return (
    <div style={s.page}>
      {/* Top Nav */}
      <div style={s.nav} className="pricing-nav">
        <div style={s.navBrand}>
          <div style={s.logoIcon}><img src={BixianLogo} alt="Bixian" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /></div>
          <span style={s.logoText}>Bixian CRM</span>
        </div>
        <div style={s.navActions}>
          <button style={s.navLink} onClick={() => navigate('/login')}>Login</button>
          <button style={s.registerBtn} onClick={() => navigate('/register')}>Register</button>
        </div>
      </div>

      {/* Hero */}
      <div style={s.hero} className="pricing-hero">
        <h1 style={s.heroTitle}>Simple, Transparent Pricing</h1>
        <p style={s.heroSub}>Choose the plan that fits your business. No hidden fees.</p>
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

      {/* Plans */}
      {loading ? (
        <div style={s.spinnerWrap}><div style={s.spinner} /></div>
      ) : (
        <div className="pricing-grid">
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
        .pricing-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; max-width: 1400px; margin: 0 auto; padding: 0 24px; }
        @media (max-width: 1100px) { .pricing-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 600px) {
          .pricing-grid { grid-template-columns: 1fr; padding: 0 16px; gap: 16px; }
          .pricing-nav { padding: 12px 16px !important; }
          .pricing-hero { padding: 36px 16px 28px !important; }
          .pricing-hero h1 { font-size: 26px !important; }
          .pricing-hero p { font-size: 14px !important; }
        }
      `}</style>
    </div>
  );
};

const s = {
  page: { minHeight: '100vh', background: '#0d0d1a', color: '#e2e2f0', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', paddingBottom: 60 },
  nav: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 32px', borderBottom: '1px solid #1e1e3a', position: 'sticky', top: 0, background: '#0d0d1a', zIndex: 10 },
  navBrand: { display: 'flex', alignItems: 'center', gap: 10 },
  logoIcon: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 9, overflow: 'hidden' },
  logoText: { fontSize: 16, fontWeight: 700, color: '#e2e2f0' },
  navActions: { display: 'flex', alignItems: 'center', gap: 12 },
  navLink: { background: 'none', border: 'none', color: '#9ca3af', fontSize: 14, cursor: 'pointer', padding: '8px 14px', borderRadius: 8 },
  registerBtn: { background: 'linear-gradient(135deg, #e94560, #7c3aed)', border: 'none', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: '8px 18px', borderRadius: 8 },
  hero: { textAlign: 'center', padding: '60px 20px 40px' },
  toggle: { display: 'inline-flex', background: '#12121f', border: '1px solid #1e1e3a', borderRadius: 30, padding: 4, marginTop: 24, gap: 4, flexWrap: 'wrap', justifyContent: 'center' },
  toggleBtn: { background: 'none', border: 'none', color: '#9ca3af', fontSize: 14, fontWeight: 500, padding: '8px 20px', borderRadius: 26, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 },
  toggleActive: { background: 'linear-gradient(135deg, #e94560, #7c3aed)', color: '#fff' },
  saveBadge: { fontSize: 10, background: 'rgba(34,197,94,0.2)', color: '#22c55e', padding: '2px 7px', borderRadius: 20, fontWeight: 700 },
  heroTitle: { fontSize: 36, fontWeight: 800, margin: '0 0 12px', background: 'linear-gradient(135deg, #e2e2f0, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  heroSub: { fontSize: 16, color: '#9ca3af', margin: 0 },
  spinnerWrap: { display: 'flex', justifyContent: 'center', padding: 60 },
  spinner: { width: 40, height: 40, border: '3px solid #1e1e3a', borderTopColor: '#e94560', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  grid: { },
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
