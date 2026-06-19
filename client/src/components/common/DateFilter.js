import React, { useState } from 'react';

const getDateRange = (preset) => {
  const today = new Date();
  const fmt = (d) => d.toISOString().slice(0, 10);
  const y = today.getFullYear(), m = today.getMonth(), day = today.getDate();
  if (preset === 'today') return { dateFrom: fmt(today), dateTo: fmt(today) };
  if (preset === 'this_week') {
    const dow = today.getDay();
    const mon = new Date(y, m, day - (dow === 0 ? 6 : dow - 1));
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return { dateFrom: fmt(mon), dateTo: fmt(sun) };
  }
  if (preset === 'this_month') return {
    dateFrom: `${y}-${String(m + 1).padStart(2, '0')}-01`,
    dateTo: fmt(new Date(y, m + 1, 0)),
  };
  if (preset === 'last_month') {
    const lm = new Date(y, m - 1, 1);
    return { dateFrom: fmt(lm), dateTo: fmt(new Date(y, m, 0)) };
  }
  return { dateFrom: '', dateTo: '' };
};

const DateFilter = ({ onChange }) => {
  const [preset, setPreset] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const handlePreset = (p) => {
    setPreset(p);
    if (p === 'custom') {
      onChange({ dateFrom: from, dateTo: to });
    } else {
      onChange(getDateRange(p));
    }
  };

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <select
        className="filter-select"
        value={preset}
        onChange={e => handlePreset(e.target.value)}
        style={{ minWidth: 130 }}
      >
        <option value="">All Time</option>
        <option value="today">Today</option>
        <option value="this_week">This Week</option>
        <option value="this_month">This Month</option>
        <option value="last_month">Last Month</option>
        <option value="custom">Custom Range</option>
      </select>
      {preset === 'custom' && (
        <>
          <input
            type="date"
            className="filter-select"
            value={from}
            onChange={e => { setFrom(e.target.value); onChange({ dateFrom: e.target.value, dateTo: to }); }}
            style={{ width: 140, padding: '5px 8px' }}
          />
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>to</span>
          <input
            type="date"
            className="filter-select"
            value={to}
            onChange={e => { setTo(e.target.value); onChange({ dateFrom: from, dateTo: e.target.value }); }}
            style={{ width: 140, padding: '5px 8px' }}
          />
        </>
      )}
    </div>
  );
};

export default DateFilter;
