// SensitiveView.jsx — Masked sensitive message detections
import { useEffect, useState } from 'react';
import { ShieldAlert, EyeOff } from 'lucide-react';
import { api } from '../api';
import { RISK_BADGE } from '../utils';

const ACTION_LABELS = {
  do_not_store:         '🚫 Do Not Store',
  do_not_send_external: '🔒 Do Not Send Externally',
  safe_to_process_locally: '✅ Safe Locally',
  ask_for_confirmation: '❓ Ask for Confirmation',
};

const TYPE_LABELS = {
  password:                 'Password',
  payment_card:             'Payment Card',
  one_time_password:        'One-Time Password',
  authentication_token:     'Auth Token',
  account_recovery_code:    'Recovery Code',
  personal_identification:  'Personal ID',
  private_address:          'Private Address',
  personal_health_information: 'Health Info',
  personal_preference:      'Personal Preference',
};

export default function SensitiveView() {
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [risk, setRisk] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const PAGE_SIZE = 25;

  useEffect(() => { setPage(1); }, [risk, type]);

  useEffect(() => {
    setLoading(true);
    const params = { page, page_size: PAGE_SIZE };
    if (risk) params.risk = risk;
    if (type) params.sensitivity_type = type;
    api.sensitive(params)
      .then(d => { setData(d.data || []); setTotal(d.total || 0); })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [page, risk, type]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <div className="page-header">
        <h1>Sensitive Information Detections</h1>
        <p>{total} messages flagged. All sensitive values are masked — originals are never stored.</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6" style={{ flexWrap: 'wrap' }}>
        <select className="filter-select" value={risk} onChange={e => setRisk(e.target.value)}>
          <option value="">All Risk Levels</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select className="filter-select" value={type} onChange={e => setType(e.target.value)}>
          <option value="">All Types</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <span className="text-muted text-sm" style={{ alignSelf: 'center' }}>
          {total} detections
        </span>
      </div>

      {loading ? (
        <div className="loading-spinner"><div className="spinner" /><span>Loading…</span></div>
      ) : data.length === 0 ? (
        <div className="empty-state">No detections found.</div>
      ) : (
        <>
          {data.map(item => (
            <div key={item.message_id} className="sensitive-card">
              <div className="sensitive-header">
                <div className="flex items-center gap-2">
                  <ShieldAlert size={16} color="var(--risk-high)" />
                  <span className="font-mono text-sm" style={{ color: 'var(--accent-blue)' }}>
                    {item.message_id}
                  </span>
                  <span className={`badge ${RISK_BADGE[item.risk] || ''}`}>
                    {item.risk} risk
                  </span>
                </div>
                <span className="badge badge-sensitive">
                  {TYPE_LABELS[item.sensitivity_type] || item.sensitivity_type}
                </span>
              </div>

              <div className="flex items-center gap-2 mb-4">
                <EyeOff size={12} color="var(--text-muted)" />
                <div className="masked-text">{item.masked_text}</div>
              </div>

              <div className="flex gap-3" style={{ flexWrap: 'wrap' }}>
                <div className="text-xs">
                  <span className="text-muted">Recommended action: </span>
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {ACTION_LABELS[item.recommended_action] || item.recommended_action}
                  </strong>
                </div>
                <div className="text-xs">
                  <span className="text-muted">Description: </span>
                  <span style={{ color: 'var(--text-secondary)' }}>{item.description}</span>
                </div>
              </div>
            </div>
          ))}

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
