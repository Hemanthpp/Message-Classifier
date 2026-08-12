// ClassificationView.jsx — Table with click-to-expand detail panel
import { useEffect, useState, useCallback } from 'react';
import { Search, Filter, X, Shield, Calendar, ChevronRight } from 'lucide-react';
import { api } from '../api';
import {
  CATEGORY_LABELS, CATEGORY_BADGE, confidenceClass, formatPercent, formatDate
} from '../utils';

const CATEGORIES = [
  '', 'action_required', 'meeting_or_event', 'personal_information',
  'general_information', 'promotional', 'sensitive_information',
];

const RISK_BADGE = { critical:'badge-critical', high:'badge-high', medium:'badge-medium', low:'badge-low' };
const TYPE_LABELS = {
  password:'Password', payment_card:'Payment Card', one_time_password:'OTP',
  authentication_token:'Auth Token', account_recovery_code:'Recovery Code',
  personal_identification:'Personal ID', private_address:'Private Address',
  personal_health_information:'Health Info', personal_preference:'Personal Preference',
};
const ACTION_LABELS = {
  do_not_store:'Do Not Store', do_not_send_external:'Do Not Send Externally',
  safe_to_process_locally:'Safe Locally', ask_for_confirmation:'Ask for Confirmation',
};

// ── Detail panel shown when a row is clicked ─────────────────
function DetailPanel({ messageId, onClose }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!messageId) return;
    setLoading(true);
    api.classification(messageId)
      .then(d => { setDetail(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [messageId]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(2px)',
          animation: 'fadeIn 0.15s ease',
        }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 'min(480px, 90vw)',
        background: 'var(--surface-1)',
        borderLeft: '1px solid var(--line-strong)',
        zIndex: 201,
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideIn 0.2s ease',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1.1rem 1.4rem',
          borderBottom: '1px solid var(--line)',
          flexShrink: 0,
        }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: '0.82rem', color: 'var(--accent)', fontWeight: 600 }}>
            {messageId}
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--t3)', padding: 4, borderRadius: 4,
              display: 'flex', transition: 'color 0.15s',
            }}
            onMouseEnter={e => e.target.style.color = 'var(--t1)'}
            onMouseLeave={e => e.target.style.color = 'var(--t3)'}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.4rem' }}>
          {loading ? (
            <div className="loading-spinner" style={{ padding: '3rem 0' }}>
              <div className="spinner" />
            </div>
          ) : !detail ? (
            <div className="empty-state">Could not load details.</div>
          ) : (
            <>
              {/* Classification */}
              <Section title="Classification">
                <Row label="Category">
                  <span className={`badge ${CATEGORY_BADGE[detail.category] || ''}`}>
                    {CATEGORY_LABELS[detail.category] || detail.category}
                  </span>
                </Row>
                <Row label="Confidence">
                  <span className={`confidence font-mono ${confidenceClass(detail.confidence)}`}>
                    {formatPercent(detail.confidence)}
                  </span>
                </Row>
                <Row label="Reason">
                  <span style={{ color: 'var(--t2)', fontSize: '0.8rem', lineHeight: 1.55 }}>
                    {detail.reason}
                  </span>
                </Row>
              </Section>

              {/* Sensitive detection */}
              {detail.sensitive && (
                <Section title="Sensitive Detection" icon={<Shield size={13} color="var(--red)" />}>
                  <Row label="Type">
                    <span className="badge badge-sensitive">
                      {TYPE_LABELS[detail.sensitive.sensitivity_type] || detail.sensitive.sensitivity_type}
                    </span>
                  </Row>
                  <Row label="Risk">
                    <span className={`badge ${RISK_BADGE[detail.sensitive.risk] || ''}`}>
                      {detail.sensitive.risk}
                    </span>
                  </Row>
                  <Row label="Masked text">
                    <code style={{
                      fontFamily: 'var(--mono)', fontSize: '0.73rem',
                      background: 'var(--surface-2)', border: '1px solid var(--line)',
                      borderRadius: 4, padding: '0.35rem 0.55rem',
                      color: 'var(--t2)', display: 'block', lineHeight: 1.6,
                      wordBreak: 'break-all',
                    }}>
                      {detail.sensitive.masked_text}
                    </code>
                  </Row>
                  <Row label="Action">
                    <span style={{ fontSize: '0.78rem', color: 'var(--t2)' }}>
                      {ACTION_LABELS[detail.sensitive.recommended_action] || detail.sensitive.recommended_action}
                    </span>
                  </Row>
                </Section>
              )}

              {/* Tasks / Events */}
              {detail.tasks_events && detail.tasks_events.length > 0 && (
                <Section title="Extracted Items" icon={<Calendar size={13} color="var(--green)" />}>
                  {detail.tasks_events.map(item => (
                    <div key={item.item_id} style={{
                      background: 'var(--surface-2)',
                      border: '1px solid var(--line)',
                      borderRadius: 'var(--r-sm)',
                      padding: '0.75rem',
                      marginTop: '0.5rem',
                    }}>
                      <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
                        <span className={`badge badge-${item.type}`}>
                          {item.type === 'task' ? 'Task' : 'Event'}
                        </span>
                        <span className={`badge badge-${item.priority === 'high' ? 'critical' : item.priority === 'medium' ? 'medium' : 'low'}`}>
                          {item.priority}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--t1)', marginBottom: 6 }}>
                        {item.title}
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {(item.deadline || item.date) && (
                          <span style={{ fontSize: '0.73rem', color: 'var(--t3)' }}>
                            📅 {formatDate(item.deadline || item.date)}
                            {item.deadline === 'unresolved' || item.date === 'unresolved'
                              ? <span style={{ color: 'var(--amber)', marginLeft: 6 }}>— date unclear</span>
                              : ''}
                          </span>
                        )}
                        {item.time && (
                          <span style={{ fontSize: '0.73rem', color: 'var(--t3)' }}>🕐 {item.time}</span>
                        )}
                        {item.location && (
                          <span style={{ fontSize: '0.73rem', color: 'var(--t3)' }}>📍 {item.location}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </Section>
              )}
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideIn { from { transform: translateX(100%) } to { transform: translateX(0) } }
      `}</style>
    </>
  );
}

// Small layout helpers
function Section({ title, icon, children }) {
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: '0.7rem', fontWeight: 600, color: 'var(--t3)',
        textTransform: 'uppercase', letterSpacing: '0.06em',
        marginBottom: '0.75rem',
      }}>
        {icon}{title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {children}
      </div>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
      <span style={{
        fontSize: '0.73rem', color: 'var(--t3)', width: 90,
        flexShrink: 0, paddingTop: 2,
      }}>
        {label}
      </span>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────
export default function ClassificationView() {
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState('');
  const [query, setQuery] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const PAGE_SIZE = 50;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query), 350);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => { setPage(1); }, [category, debouncedQ]);

  useEffect(() => {
    setLoading(true);
    const params = { page, page_size: PAGE_SIZE };
    if (category) params.category = category;

    const fetcher = debouncedQ
      ? api.search({ q: debouncedQ, ...(category ? { category } : {}), page, page_size: PAGE_SIZE })
      : api.classifications(params);

    fetcher
      .then(d => { setData(d.data || []); setTotal(d.total || 0); })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [page, category, debouncedQ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <div className="page-header">
        <h1>Classifications</h1>
        <p>{total} messages · click any row to see full details</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4" style={{ flexWrap: 'wrap' }}>
        <div className="search-bar" style={{ flex: 1, minWidth: 200 }}>
          <Search size={13} color="var(--t3)" />
          <input
            placeholder="Search by message ID or reason…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        <select
          className="filter-select"
          value={category}
          onChange={e => setCategory(e.target.value)}
        >
          <option value="">All Categories</option>
          {CATEGORIES.filter(Boolean).map(c => (
            <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
          ))}
        </select>
        <span className="text-muted text-xs" style={{ alignSelf: 'center' }}>
          {total} results
        </span>
      </div>

      {loading ? (
        <div className="loading-spinner"><div className="spinner" /></div>
      ) : (
        <>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Message ID</th>
                  <th>Category</th>
                  <th>Confidence</th>
                  <th>Reason</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr><td colSpan={5} className="empty-state">No results.</td></tr>
                ) : data.map(row => (
                  <tr
                    key={row.message_id}
                    onClick={() => setSelectedId(row.message_id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td><span className="msg-id">{row.message_id}</span></td>
                    <td>
                      <span className={`badge ${CATEGORY_BADGE[row.category] || ''}`}>
                        {CATEGORY_LABELS[row.category] || row.category}
                      </span>
                    </td>
                    <td>
                      <span className={`confidence font-mono ${confidenceClass(row.confidence)}`}>
                        {formatPercent(row.confidence)}
                      </span>
                    </td>
                    <td><span className="reason-text">{row.reason}</span></td>
                    <td style={{ width: 20 }}>
                      <ChevronRight size={13} color="var(--t3)" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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

      {/* Detail panel */}
      {selectedId && (
        <DetailPanel
          messageId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
