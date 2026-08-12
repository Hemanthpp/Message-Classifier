import { useState } from 'react';
import { Play, ShieldAlert, Calendar, Tag, CheckCircle2 } from 'lucide-react';
import { api } from '../api';
import { CATEGORY_LABELS, CATEGORY_BADGE, confidenceClass, formatPercent, formatDate } from '../utils';

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

export default function Playground() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const analyze = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.analyze(text);
      setResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Live Playground</h1>
        <p>Test the classification, extraction, and masking pipeline in real-time.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        
        {/* Input Column */}
        <div>
          <div style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--r-md)',
            padding: '1.25rem',
          }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--t1)', marginBottom: '0.75rem' }}>
              Input Message
            </div>
            
            <textarea
              placeholder="Type a message here... e.g. 'Let's schedule a meeting tomorrow at 3 PM' or 'My password is secret123'"
              value={text}
              onChange={e => setText(e.target.value)}
              style={{
                width: '100%',
                height: 150,
                background: 'var(--bg)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--r-sm)',
                padding: '0.875rem',
                color: 'var(--t1)',
                fontFamily: 'var(--font)',
                fontSize: '0.85rem',
                lineHeight: 1.5,
                resize: 'none',
                outline: 'none',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--line-strong)'}
              onBlur={e => e.target.style.borderColor = 'var(--line)'}
            />
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button
                onClick={analyze}
                disabled={loading || !text.trim()}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  background: 'var(--accent)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--r-sm)',
                  padding: '0.6rem 1.25rem',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: (loading || !text.trim()) ? 'not-allowed' : 'pointer',
                  opacity: (loading || !text.trim()) ? 0.6 : 1,
                  transition: 'opacity 0.15s',
                }}
              >
                {loading ? <div className="spinner" style={{ width: 14, height: 14, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} /> : <Play size={14} />}
                Analyze
              </button>
            </div>
          </div>
          
          <div style={{ marginTop: '1.5rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
              Try these examples
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <ExampleButton text="Hi team, can you review the Q3 report before 5 PM today?" onClick={setText} />
              <ExampleButton text="My credit card number is 4111 1111 1111 1111." onClick={setText} />
              <ExampleButton text="Calendar update: sync with marketing on 2026-10-15 at 14:00." onClick={setText} />
            </div>
          </div>
        </div>

        {/* Output Column */}
        <div>
          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--red)', padding: '1rem', borderRadius: 'var(--r-md)', border: '1px solid rgba(239,68,68,0.2)' }}>
              {error}
            </div>
          )}

          {!result && !loading && !error && (
            <div style={{ 
              height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              border: '1px dashed var(--line)', borderRadius: 'var(--r-md)', padding: '3rem', color: 'var(--t3)'
            }}>
              <CheckCircle2 size={32} style={{ marginBottom: '1rem', opacity: 0.5 }} />
              <div style={{ fontSize: '0.85rem' }}>Results will appear here</div>
            </div>
          )}
          
          {loading && (
             <div style={{ 
              height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              border: '1px dashed var(--line)', borderRadius: 'var(--r-md)', padding: '3rem', color: 'var(--t3)'
            }}>
              <div className="spinner" style={{ marginBottom: '1rem' }} />
              <div style={{ fontSize: '0.85rem' }}>Processing message...</div>
            </div>
          )}

          {result && !loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', animation: 'fadeIn 0.3s ease' }}>
              
              {/* Classification */}
              <div style={{ background: 'var(--surface-1)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1rem' }}>
                  <Tag size={14} /> Classification
                </div>
                
                <div style={{ display: 'flex', gap: '2rem', marginBottom: '1rem' }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--t3)', marginBottom: 4 }}>Category</div>
                    <span className={`badge ${CATEGORY_BADGE[result.classification.category] || ''}`}>
                      {CATEGORY_LABELS[result.classification.category] || result.classification.category}
                    </span>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--t3)', marginBottom: 4 }}>Confidence</div>
                    <span className={`confidence font-mono ${confidenceClass(result.classification.confidence)}`}>
                      {formatPercent(result.classification.confidence)}
                    </span>
                  </div>
                </div>
                
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--t3)', marginBottom: 4 }}>Reason</div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--t1)' }}>{result.classification.reason}</div>
                </div>
              </div>

              {/* Sensitive Info */}
              {result.sensitive && (
                <div style={{ background: 'var(--surface-1)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1rem' }}>
                    <ShieldAlert size={14} color="var(--red)" /> Sensitive Data Detected
                  </div>
                  
                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                    <span className="badge badge-sensitive">
                      {TYPE_LABELS[result.sensitive.sensitivity_type] || result.sensitive.sensitivity_type}
                    </span>
                    <span className={`badge ${RISK_BADGE[result.sensitive.risk] || ''}`}>
                      {result.sensitive.risk.toUpperCase()} RISK
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--t2)', alignSelf: 'center' }}>
                      → {ACTION_LABELS[result.sensitive.recommended_action] || result.sensitive.recommended_action}
                    </span>
                  </div>
                  
                  <div style={{ fontSize: '0.7rem', color: 'var(--t3)', marginBottom: 4 }}>Masked Output</div>
                  <code style={{
                    fontFamily: 'var(--mono)', fontSize: '0.78rem',
                    background: 'var(--surface-2)', border: '1px solid var(--line-strong)',
                    borderRadius: 4, padding: '0.6rem 0.8rem',
                    color: 'var(--t1)', display: 'block', lineHeight: 1.6,
                    wordBreak: 'break-all',
                  }}>
                    {result.sensitive.masked_text}
                  </code>
                </div>
              )}

              {/* Extracted Tasks/Events */}
              {result.tasks_events && result.tasks_events.length > 0 && (
                <div style={{ background: 'var(--surface-1)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1rem' }}>
                    <Calendar size={14} color="var(--green)" /> Extracted Items
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {result.tasks_events.map((item, idx) => (
                      <div key={idx} style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', padding: '0.875rem' }}>
                        <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
                          <span className={`badge badge-${item.type}`}>
                            {item.type === 'task' ? 'Task' : 'Event'}
                          </span>
                          <span className={`badge badge-${item.priority === 'high' ? 'critical' : item.priority === 'medium' ? 'medium' : 'low'}`}>
                            {item.priority} Priority
                          </span>
                        </div>
                        <p style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--t1)', marginBottom: 8 }}>
                          {item.title}
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                          {(item.deadline || item.date) && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--t2)' }}>
                              <span style={{ color: 'var(--t3)', marginRight: 4 }}>Date:</span> 
                              {formatDate(item.deadline || item.date)}
                            </div>
                          )}
                          {item.time && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--t2)' }}>
                              <span style={{ color: 'var(--t3)', marginRight: 4 }}>Time:</span> 
                              {item.time}
                            </div>
                          )}
                          {item.location && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--t2)' }}>
                              <span style={{ color: 'var(--t3)', marginRight: 4 }}>Location:</span> 
                              {item.location}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}

function ExampleButton({ text, onClick }) {
  return (
    <button
      onClick={() => onClick(text)}
      style={{
        background: 'var(--surface-1)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-sm)',
        padding: '0.6rem 0.875rem',
        color: 'var(--t2)',
        fontSize: '0.78rem',
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'all 0.15s',
        display: 'block',
        width: '100%',
      }}
      onMouseEnter={e => { e.target.style.background = 'var(--surface-2)'; e.target.style.color = 'var(--t1)'; }}
      onMouseLeave={e => { e.target.style.background = 'var(--surface-1)'; e.target.style.color = 'var(--t2)'; }}
    >
      "{text}"
    </button>
  );
}
