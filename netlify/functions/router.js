const { supabase, ok, err, verifyToken, preflight } = require('./_db');

// This is the main API router function
// Netlify rewrites /api/* → /.netlify/functions/router/*
// So all our endpoints go through here based on path segments

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();

  const rawPath = event.path || '';
  // Strip /api/ or /.netlify/functions/router/ prefix
  const path = rawPath
    .replace(/^\/api\//, '')
    .replace(/^\/.netlify\/functions\/router\//, '')
    .replace(/^\/.netlify\/functions\//, '');

  const segment = path.split('/')[0];

  // Route to correct handler
  switch (segment) {
    case 'subunits':    return require('./api').handler({ ...event, path });
    case 'announcements': return require('./api').handler({ ...event, path });
    case 'events':      return require('./api').handler({ ...event, path });
    case 'messages':    return require('./api').handler({ ...event, path });
    case 'notifications': return require('./api').handler({ ...event, path });
    case 'users':       return require('./users').handler({ ...event, path: path.replace('users', '') });
    case 'attendance':  return require('./attendance').handler({ ...event, path: path.replace('attendance', '') });
    case 'auth':        return require('./auth').handler({ ...event, path: path.replace('auth/', '') });
    default:
      return err('API endpoint not found: ' + path, 404);
  }
};
