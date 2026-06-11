const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'lamak-hospitality-secret-change-in-production';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };
}

function respond(statusCode, body) {
  return { statusCode, headers: corsHeaders(), body: JSON.stringify(body) };
}

function ok(body) { return respond(200, body); }
function err(msg, code = 400) { return respond(code, { error: msg }); }

async function verifyToken(event) {
  const auth = (event.headers && (event.headers.authorization || event.headers.Authorization)) || '';
  const token = auth.replace('Bearer ', '');
  if (!token) return null;
  try { return jwt.verify(token, JWT_SECRET); } catch { return null; }
}

function preflight() {
  return { statusCode: 204, headers: corsHeaders(), body: '' };
}

// Extract sub-path from event for a given function name
// e.g. for function "users": /api/users/stats → "stats"
//                             /api/users/abc123/status → "abc123/status"
function subPath(event, fnName) {
  const raw = event.path || '';
  const stripped = raw
    .replace(`/.netlify/functions/${fnName}`, '')
    .replace(`/api/${fnName}`, '')
    .replace(/^\/+/, '');
  return stripped;
}

module.exports = { supabase, jwt, JWT_SECRET, ok, err, verifyToken, preflight, subPath };
