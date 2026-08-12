// App.jsx — Minimalist sidebar layout
import { useState } from 'react';
import {
  LayoutDashboard, Tag, Calendar, ShieldAlert, Star,
} from 'lucide-react';
import Dashboard from './components/Dashboard';
import ClassificationView from './components/ClassificationView';
import TasksEventsView from './components/TasksEventsView';
import SensitiveView from './components/SensitiveView';
import MandatoryPanel from './components/MandatoryPanel';

const NAV = [
  { id: 'dashboard',       label: 'Overview',         icon: LayoutDashboard },
  { id: 'classifications', label: 'Classifications',   icon: Tag },
  { id: 'tasks',           label: 'Tasks & Events',    icon: Calendar },
  { id: 'sensitive',       label: 'Sensitive',         icon: ShieldAlert },
  { id: 'mandatory',       label: 'Mandatory IDs',     icon: Star },
];

function renderPage(active) {
  switch (active) {
    case 'dashboard':       return <Dashboard />;
    case 'classifications': return <ClassificationView />;
    case 'tasks':           return <TasksEventsView />;
    case 'sensitive':       return <SensitiveView />;
    case 'mandatory':       return <MandatoryPanel />;
    default:                return <Dashboard />;
  }
}

export default function App() {
  const [active, setActive] = useState('dashboard');

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <h2>Message Intelligence</h2>
          <p>AI/ML Intern Assignment</p>
        </div>

        <nav className="sidebar-nav">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              id={`nav-${id}`}
              className={`nav-item${active === id ? ' active' : ''}`}
              onClick={() => setActive(id)}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div>900 messages</div>
          <div>Rule-based + TF-IDF</div>
          <div style={{ marginTop: 4, color: 'var(--t3)' }}>No external APIs</div>
        </div>
      </aside>

      <main className="main-content">
        {renderPage(active)}
      </main>
    </div>
  );
}
