import React from 'react';

const Pagination = ({ pagination, onPageChange }) => {
  if (!pagination || pagination.totalPages <= 1) return null;
  const { page, totalPages, total, limit } = pagination;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  const pages = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div className="pagination">
      <span className="pagination-info">Showing {from}–{to} of {total}</span>
      <div className="pagination-controls">
        <button className="page-btn" onClick={() => onPageChange(1)} disabled={page === 1}>«</button>
        <button className="page-btn" onClick={() => onPageChange(page - 1)} disabled={page === 1}>‹</button>
        {start > 1 && <span className="page-ellipsis">…</span>}
        {pages.map((p) => (
          <button key={p} className={`page-btn${p === page ? ' active' : ''}`} onClick={() => onPageChange(p)}>{p}</button>
        ))}
        {end < totalPages && <span className="page-ellipsis">…</span>}
        <button className="page-btn" onClick={() => onPageChange(page + 1)} disabled={page === totalPages}>›</button>
        <button className="page-btn" onClick={() => onPageChange(totalPages)} disabled={page === totalPages}>»</button>
      </div>
    </div>
  );
};

export default Pagination;
