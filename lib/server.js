import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export function allowRequest(req, res) {
  if (!['GET', 'POST', 'PATCH'].includes(req.method)) { res.status(405).json({ error: 'Method not allowed' }); return false; }
  const pass = process.env.DEMO_ACCESS_CODE;
  if (pass && req.headers['x-demo-code'] !== pass) { res.status(401).json({ error: 'Invalid demo access code' }); return false; }
  return true;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'tickets.json');

function readLocalTickets() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(DATA_FILE)) return [];
    const content = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(content) || [];
  } catch {
    return [];
  }
}

function writeLocalTickets(tickets) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(tickets, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write local tickets:', err);
  }
}

function getSupabaseBaseUrl() {
  return (process.env.SUPABASE_URL || '')
    .trim()
    .replace(/\/rest\/v1\/?$/i, '')
    .replace(/\/+$/, '');
}

function isSupabaseConfigured() {
  const base = getSupabaseBaseUrl().toLowerCase();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  // Check if real Supabase credentials exist
  return Boolean(
    base &&
    key &&
    !base.includes('your-project') &&
    !key.includes('replace_with_your')
  );
}

function localDb(pathStr, { method = 'GET', body } = {}) {
  let tickets = readLocalTickets();

  if (method === 'POST') {
    const maxNum = tickets.reduce((max, t) => Math.max(max, Number(t.ticket_number) || 0), 1000);
    const newTicket = {
      id: crypto.randomUUID(),
      ticket_number: maxNum + 1,
      status: body?.status || 'open',
      created_at: new Date().toISOString(),
      ...body
    };
    tickets.unshift(newTicket);
    writeLocalTickets(tickets);
    return [newTicket];
  }

  if (method === 'PATCH') {
    const idMatch = pathStr.match(/id=eq\.([^&]+)/);
    if (!idMatch) return [];
    const targetId = decodeURIComponent(idMatch[1]);
    const idx = tickets.findIndex(t => t.id === targetId);
    if (idx === -1) return [];
    tickets[idx] = { ...tickets[idx], ...body };
    writeLocalTickets(tickets);
    return [tickets[idx]];
  }

  // GET
  const numMatch = pathStr.match(/ticket_number=eq\.(\d+)/);
  if (numMatch) {
    const targetNum = Number(numMatch[1]);
    return tickets.filter(t => t.ticket_number === targetNum);
  }

  const sorted = [...tickets].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return sorted.slice(0, 60);
}

function localCountRows(pathStr) {
  const tickets = readLocalTickets();
  if (pathStr.includes('status=neq.resolved')) {
    return tickets.filter(t => t.status !== 'resolved').length;
  }
  return tickets.length;
}

export async function db(pathStr, { method = 'GET', body } = {}) {
  if (!isSupabaseConfigured()) {
    return localDb(pathStr, { method, body });
  }

  const base = getSupabaseBaseUrl();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const response = await fetch(`${base}/rest/v1/${pathStr}`, {
    method,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Database error (${response.status}): ${errText || response.statusText}`);
  }
  return response.json();
}

export async function countRows(pathStr) {
  if (!isSupabaseConfigured()) {
    return localCountRows(pathStr);
  }

  const base = getSupabaseBaseUrl();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const response = await fetch(`${base}/rest/v1/${pathStr}`, { method: 'HEAD', headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: 'count=exact' } });
  if (!response.ok) throw new Error(`Database count failed (${response.status})`);
  const contentRange = response.headers.get('content-range');
  if (!contentRange || !/^\d+$/.test(contentRange.split('/').pop())) throw new Error('Database did not provide a count');
  return Number(contentRange.split('/').pop());
}

export function fail(res, err) {
  console.error(err);
  const msg = err.message || 'Server request failed';
  res.status(500).json({ error: msg.startsWith('Supabase environment') ? 'Server is not configured yet' : msg });
}
