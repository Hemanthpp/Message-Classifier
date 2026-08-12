// api.js — Centralized API client
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json();
}

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json();
}

export const api = {
  stats: () => get('/api/stats'),
  classifications: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return get(`/api/classifications${q ? '?' + q : ''}`);
  },
  classification: (id) => get(`/api/classifications/${id}`),
  tasks: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return get(`/api/tasks${q ? '?' + q : ''}`);
  },
  sensitive: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return get(`/api/sensitive${q ? '?' + q : ''}`);
  },
  mandatory: () => get('/api/mandatory'),
  search: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return get(`/api/search${q ? '?' + q : ''}`);
  },
  analyze: (message) => post('/api/analyze', { message }),
};
