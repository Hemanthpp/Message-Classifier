// TasksEventsView.jsx — Timeline of extracted tasks and events
import { useEffect, useState } from 'react';
import { Calendar, Clock, User, Flag, Link } from 'lucide-react';
import { api } from '../api';
import { formatDate } from '../utils';

const PRIORITY_BADGE = {
  high:   'badge-critical',
  medium: 'badge-medium',
  low:    'badge-low',
};

const TYPE_COLORS = {
  task:  'var(--accent-blue)',
  event: 'var(--accent-purple)',
};

function MetaChip({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <span className="flex items-center gap-2 text-xs text-muted" style={{ minWidth: 80 }}>
      <Icon size={12} style={{ flexShrink: 0 }} />
      <span style={{ color: 'var(--text-secondary)' }}>{label}:</span>
      <strong style={{ color: value === '⚠ unresolved' ? 'var(--accent-amber)' : 'var(--text-primary)' }}>
        {value}
      </strong>
    </span>
  );
}

export default function TasksEventsView() {
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState('');
  const [priority, setPriority] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const PAGE_SIZE = 30;

  useEffect(() => { setPage(1); }, [filter, priority]);

  useEffect(() => {
    setLoading(true);
    const params = { page, page_size: PAGE_SIZE };
    if (filter) params.type = filter;
    if (priority) params.priority = priority;
    api.tasks(params)
      .then(d => { setData(d.data || []); setTotal(d.total || 0); })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [page, filter, priority]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <div className="page-header">
        <h1>Tasks &amp; Events</h1>
        <p>{total} items extracted from action-required and meeting messages.</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6" style={{ flexWrap: 'wrap' }}>
        <select className="filter-select" value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="">All Types</option>
          <option value="task">Tasks</option>
          <option value="event">Events</option>
        </select>
        <select className="filter-select" value={priority} onChange={e => setPriority(e.target.value)}>
          <option value="">All Priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <span className="text-muted text-sm" style={{ alignSelf: 'center' }}>
          {total} items
        </span>
      </div>

      {loading ? (
        <div className="loading-spinner"><div className="spinner" /><span>Loading…</span></div>
      ) : (
        <>
          <div className="timeline">
            {data.length === 0 ? (
              <div className="empty-state">No items found.</div>
            ) : data.map((item, idx) => (
              <div key={item.item_id} className="timeline-item">
                {/* Date column */}
                <div className="timeline-date">
                  <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.8rem' }}>
                    {formatDate(item.deadline || item.date)}
                  </div>
                  {item.time && (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: 2 }}>
                      {item.time}
                    </div>
                  )}
                </div>

                {/* Connector */}
                <div className="timeline-line">
                  <div className="timeline-dot" style={{ borderColor: TYPE_COLORS[item.type] }} />
                  {idx < data.length - 1 && <div className="timeline-connector" />}
                </div>

                {/* Card */}
                <div className="timeline-card" style={{ marginTop: 0 }}>
                  <div className="flex items-center gap-2 mb-4" style={{ flexWrap: 'wrap' }}>
                    <span className={`badge badge-${item.type}`}>
                      {item.type === 'task' ? '✓ Task' : '📅 Event'}
                    </span>
                    <span className={`badge ${PRIORITY_BADGE[item.priority] || ''}`}>
                      {item.priority} priority
                    </span>
                    <span className="font-mono text-xs text-muted" style={{ marginLeft: 'auto' }}>
                      {item.item_id}
                    </span>
                  </div>

                  <h3 style={{ marginBottom: '0.5rem', fontSize: '0.95rem', fontWeight: 600 }}>
                    {item.title}
                  </h3>

                  <p className="text-sm text-muted" style={{ marginBottom: '0.75rem', lineHeight: 1.5 }}>
                    {item.description}
                  </p>

                  <div className="flex gap-3" style={{ flexWrap: 'wrap' }}>
                    {item.person && <MetaChip icon={User} label="Person" value={item.person} />}
                    {item.location && <MetaChip icon={Calendar} label="Location" value={item.location} />}
                    <MetaChip icon={Link} label="Source" value={item.source_message_id} />
                    {(item.deadline === 'unresolved' || item.date === 'unresolved') && (
                      <span className="badge badge-medium">⚠ Unresolved date</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button className="pag-btn" onClick={() => setPage(1)} disabled={page === 1}>«</button>
              <button className="pag-btn" onClick={() => setPage(p => p - 1)} disabled={page === 1}>‹</button>
              <span className="pag-info">Page {page} of {totalPages}</span>
              <button className="pag-btn" onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>›</button>
              <button className="pag-btn" onClick={() => setPage(totalPages)} disabled={page === totalPages}>»</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
