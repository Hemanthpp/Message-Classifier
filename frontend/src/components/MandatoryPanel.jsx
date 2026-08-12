// MandatoryPanel.jsx — The 15 mandatory demo IDs
import { useEffect, useState } from 'react';
import { Star, Shield, Calendar, CheckCircle } from 'lucide-react';
import { api } from '../api';
import { CATEGORY_LABELS, CATEGORY_BADGE, RISK_BADGE, formatPercent, confidenceClass } from '../utils';

const TYPE_LABELS = {
  password: 'Password', payment_card: 'Payment Card',
  one_time_password: 'OTP', authentication_token: 'Auth Token',
  account_recovery_code: 'Recovery Code', personal_identification: 'Personal ID',
  private_address: 'Private Address', personal_health_information: 'Health Info',
  personal_preference: 'Personal Preference',
};

export default function MandatoryPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.mandatory()
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="loading-spinner"><div className="spinner" /><span>Loading mandatory IDs…</span></div>
  );

  if (!data) return (
    <div className="empty-state">Run <code>python pipeline.py</code> to generate results first.</div>
  );

  return (
    <div>
      <div className="page-header">
        <h1>Mandatory Demo IDs</h1>
        <p>All 15 required message IDs with full classification, extraction, and sensitivity data.</p>
      </div>

      <div style={{
        background: 'rgba(79,142,247,0.08)',
        border: '1px solid rgba(79,142,247,0.2)',
        borderRadius: 'var(--radius-md)',
        padding: '0.85rem 1.25rem',
        marginBottom: '1.5rem',
        fontSize: '0.82rem',
        color: 'var(--text-secondary)',
      }}>
        <Star size={14} style={{ display: 'inline', marginRight: 6, color: 'var(--accent-blue)' }} />
        These 15 IDs must be demonstrated in the video. Each card shows classification, any extracted task/event, and any sensitive detection.
      </div>

      <div className="mandatory-grid">
        {(data.data || []).map(entry => {
          const cls = entry.classification;
          const sens = entry.sensitive;
          const tasks = entry.tasks_events || [];

          return (
            <div key={entry.message_id} className="mandatory-card">
              <div className="mandatory-card-header">
                <span className="font-mono text-sm" style={{ color: 'var(--accent-blue)', fontWeight: 700 }}>
                  {entry.message_id}
                </span>
                {cls && (
                  <span className={`badge ${CATEGORY_BADGE[cls.category] || ''}`}>
                    {CATEGORY_LABELS[cls.category] || cls.category}
                  </span>
                )}
              </div>

              {cls && (
                <>
                  <div className="flex items-center gap-2 mb-4" style={{ marginTop: 2 }}>
                    <CheckCircle size={12} color="var(--accent-green)" />
                    <span className="text-xs text-muted">Confidence:</span>
                    <span className={`text-xs font-mono ${confidenceClass(cls.confidence)}`}>
                      {formatPercent(cls.confidence)}
                    </span>
                  </div>
                  <p className="text-xs text-muted" style={{ lineHeight: 1.5, marginBottom: '0.6rem' }}>
                    {cls.reason}
                  </p>
                </>
              )}

              {/* Tasks / Events */}
              {tasks.length > 0 && (
                <div style={{
                  background: 'rgba(139,92,246,0.08)',
                  border: '1px solid rgba(139,92,246,0.18)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.5rem 0.75rem',
                  marginTop: '0.6rem',
                }}>
                  <div className="flex items-center gap-2 mb-4" style={{ marginBottom: 4 }}>
                    <Calendar size={11} color="var(--accent-purple)" />
                    <span className="text-xs" style={{ color: 'var(--accent-purple)', fontWeight: 600 }}>
                      {tasks[0].type === 'event' ? 'Event' : 'Task'}: {tasks[0].title}
                    </span>
                  </div>
                  <div className="text-xs text-muted">
                    {tasks[0].deadline || tasks[0].date
                      ? `📅 ${tasks[0].deadline || tasks[0].date}`
                      : ''}
                    {tasks[0].time ? `  🕐 ${tasks[0].time}` : ''}
                  </div>
                </div>
              )}

              {/* Sensitive */}
              {sens && (
                <div style={{
                  background: 'rgba(239,68,68,0.07)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.5rem 0.75rem',
                  marginTop: '0.6rem',
                }}>
                  <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
                    <Shield size={11} color="var(--risk-high)" />
                    <span className="text-xs" style={{ color: '#fca5a5', fontWeight: 600 }}>
                      {TYPE_LABELS[sens.sensitivity_type] || sens.sensitivity_type}
                    </span>
                    <span className={`badge ${RISK_BADGE[sens.risk] || ''}`}>
                      {sens.risk}
                    </span>
                  </div>
                  <div className="font-mono text-xs" style={{ color: '#fca5a5', wordBreak: 'break-all', lineHeight: 1.5 }}>
                    {sens.masked_text}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
