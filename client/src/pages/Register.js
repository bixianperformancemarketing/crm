import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || '';
const WHATSAPP_NUMBER = '919391851610';

const Register = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const planId = searchParams.get('plan');
  const billingParam = searchParams.get('billing') || 'monthly';

  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [billing, setBilling] = useState(billingParam);
  const [form, setForm] = useState({ name: '', company: '', email: '', phone: '' });

  useEffect(() => {
    axios.get(`${API_URL}/api/public/plans`).then(({ data }) => {
      const fetched = data.plans || [];
      setPlans(fetched);
      if (planId) {
        const found = fetched.find((p) => String(p.id) === String(planId));
        if (found) setSelectedPlan(found);
      }
    });
  }, [planId]);

  const withGST = (val) => Math.round(Number(val) * 1.18);

  const CYCLE_META = {
    monthly:    { field: 'price',           label: 'Monthly',     per: '/month'     },
    quarterly:  { field: 'quarterlyPrice',  label: 'Quarterly',   per: '/quarter'   },
    halfYearly: { field: 'halfYearlyPrice', label: 'Half-Yearly', per: '/6 months'  },
    yearly:     { field: 'yearlyPrice',     label: 'Yearly',      per: '/year'      },
  };

  const activeMeta = CYCLE_META[billing] || CYCLE_META.monthly;
  const availableCycles = Object.entries(CYCLE_META).filter(([key, meta]) =>
    key === 'monthly' || plans.some(p => Number(p[meta.field]) > 0)
  );

  const getDisplayPrice = (plan) => {
    if (Number(plan.price) === 0) return 'Free';
    const val = Number(plan[activeMeta.field]);
    if (val > 0) return `₹${withGST(val).toLocaleString('en-IN')}${activeMeta.per}`;
    return `₹${withGST(plan.price).toLocaleString('en-IN')}/month`;
  };

  const handleWhatsApp = (e) => {
    e.preventDefault();
    if (!selectedPlan) return;

    const planPrice = getDisplayPrice(selectedPlan);

    const message = [
      `Hi! I'm interested in the *${selectedPlan.displayName || selectedPlan.name}* plan on Bixian CRM.`,
      ``,
      `*My Details:*`,
      `👤 Name: ${form.name}`,
      `🏢 Company: ${form.company}`,
      `📧 Email: ${form.email}`,
      `📱 Phone: ${form.phone}`,
      ``,
      `*Selected Plan:* ${selectedPlan.displayName || selectedPlan.name} — ${planPrice} (incl. 18% GST)`,
      `*Billing Cycle:* ${activeMeta.label}`,
      ``,
      `Please help me get started!`,
    ].join('\n');

    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const isFormValid = form.name && form.company && form.email && form.phone && selectedPlan;

  return (
    <div style={s.page}>
      {/* Top Nav */}
      <div style={s.nav}>
        <div style={s.navBrand}>
          <div style={s.logoIcon}>CRM</div>
          <span style={s.logoText}>Bixian CRM</span>
        </div>
        <div style={s.navActions}>
          <button style={s.navLink} onClick={() => navigate('/pricing')}>Plans</button>
          <button style={s.navLink} onClick={() => navigate('/login')}>Login</button>
        </div>
      </div>

      <div style={s.wrap}>
        <div style={s.container}>
          <h2 style={s.title}>Get Started</h2>
          <p style={s.sub}>Fill in your details and we'll get in touch via WhatsApp</p>

          <form onSubmit={handleWhatsApp} style={s.form}>
            {/* Plan Selector */}
            <div style={s.section}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={s.label}>Select a Plan</label>
                {availableCycles.length > 1 && (
                  <div style={{ display: 'flex', background: '#0a0a17', border: '1px solid #1e1e3a', borderRadius: 20, padding: 3, gap: 3, flexWrap: 'wrap' }}>
                    {availableCycles.map(([key, meta]) => (
                      <button key={key} type="button" onClick={() => setBilling(key)} style={{ background: billing === key ? 'linear-gradient(135deg,#e94560,#7c3aed)' : 'none', border: 'none', color: '#e2e2f0', fontSize: 12, fontWeight: 600, padding: '5px 14px', borderRadius: 16, cursor: 'pointer' }}>{meta.label}</button>
                    ))}
                  </div>
                )}
              </div>
              <div style={s.planGrid}>
                {plans.map((plan) => (
                  <div
                    key={plan.id}
                    style={{ ...s.planCard, ...(selectedPlan?.id === plan.id ? s.planCardActive : {}) }}
                    onClick={() => setSelectedPlan(plan)}
                  >
                    <div style={s.planCardName}>{plan.displayName || plan.name}</div>
                    <div style={s.planCardPrice}>{getDisplayPrice(plan)}</div>
                    <div style={s.planCardMeta}>{plan.maxUsersPerWorkspace} users · {plan.maxLeadsTotal} leads</div>
                    {selectedPlan?.id === plan.id && <div style={s.planCardCheck}>✓</div>}
                  </div>
                ))}
              </div>
            </div>

            {/* Form Fields */}
            <div style={s.section}>
              <label style={s.label}>Your Name *</label>
              <input
                style={s.input}
                type="text"
                placeholder="John Doe"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>

            <div style={s.section}>
              <label style={s.label}>Company Name *</label>
              <input
                style={s.input}
                type="text"
                placeholder="Your Agency Pvt Ltd"
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                required
              />
            </div>

            <div style={s.row}>
              <div style={s.section}>
                <label style={s.label}>Email Address *</label>
                <input
                  style={s.input}
                  type="email"
                  placeholder="you@agency.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>
              <div style={s.section}>
                <label style={s.label}>Phone Number *</label>
                <input
                  style={s.input}
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/[^0-9+]/g, '') })}
                  required
                />
              </div>
            </div>

            <button type="submit" style={{ ...s.submitBtn, ...(!isFormValid ? s.submitBtnDisabled : {}) }} disabled={!isFormValid}>
              <span style={s.waIcon}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              </span>
              Send via WhatsApp
            </button>

            <p style={s.note}>
              After clicking, WhatsApp will open with your details pre-filled. Send the message and our team will contact you within 24 hours.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

const s = {
  page: { minHeight: '100vh', background: '#0d0d1a', color: '#e2e2f0', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  nav: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 32px', borderBottom: '1px solid #1e1e3a', flexWrap: 'wrap', gap: 10 },
  navBrand: { display: 'flex', alignItems: 'center', gap: 10 },
  logoIcon: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, background: 'linear-gradient(135deg, #e94560, #7c3aed)', borderRadius: 9, fontSize: 12, fontWeight: 700, color: '#fff' },
  logoText: { fontSize: 16, fontWeight: 700, color: '#e2e2f0' },
  navActions: { display: 'flex', alignItems: 'center', gap: 12 },
  navLink: { background: 'none', border: 'none', color: '#9ca3af', fontSize: 14, cursor: 'pointer', padding: '8px 14px', borderRadius: 8 },
  wrap: { display: 'flex', justifyContent: 'center', padding: '24px 16px 60px' },
  container: { width: '100%', maxWidth: 640, background: '#12121f', border: '1px solid #1e1e3a', borderRadius: 16, padding: '28px 20px' },
  title: { fontSize: 24, fontWeight: 700, margin: '0 0 8px' },
  sub: { fontSize: 14, color: '#9ca3af', margin: '0 0 28px' },
  form: { display: 'flex', flexDirection: 'column', gap: 20 },
  section: { display: 'flex', flexDirection: 'column', gap: 8, flex: 1 },
  label: { fontSize: 13, fontWeight: 600, color: '#d1d5db' },
  input: { background: '#0a0a17', border: '1px solid #1e1e3a', borderRadius: 8, padding: '11px 14px', color: '#e2e2f0', fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box' },
  row: { display: 'flex', gap: 16 },
  planGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 },
  planCard: { border: '1px solid #1e1e3a', borderRadius: 10, padding: '14px 12px', cursor: 'pointer', position: 'relative', transition: 'border-color 0.15s' },
  planCardActive: { border: '1.5px solid #7c3aed', background: 'rgba(124,58,237,0.08)' },
  planCardName: { fontSize: 13, fontWeight: 700, textTransform: 'capitalize', marginBottom: 4 },
  planCardPrice: { fontSize: 15, fontWeight: 800, color: '#e94560', marginBottom: 4 },
  planCardMeta: { fontSize: 11, color: '#6b7280' },
  planCardCheck: { position: 'absolute', top: 8, right: 10, color: '#7c3aed', fontWeight: 700, fontSize: 14 },
  submitBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, background: '#25D366', border: 'none', borderRadius: 10, color: '#fff', fontSize: 15, fontWeight: 700, padding: '14px', cursor: 'pointer', marginTop: 4 },
  submitBtnDisabled: { opacity: 0.5, cursor: 'not-allowed' },
  waIcon: { display: 'flex', alignItems: 'center' },
  note: { textAlign: 'center', fontSize: 12, color: '#6b7280', margin: 0, lineHeight: 1.6 },
};

export default Register;
