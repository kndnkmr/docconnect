// ============================================
// Health watch: email the admin when the server is in trouble
// ============================================
// Two things the server can notice about itself:
//   1. Error spike — 10+ server errors (HTTP 5xx) within 10 minutes.
//   2. Database down — disconnected for 3+ minutes (and "back up" when it
//      reconnects, so you know it fixed itself).
// Each alert type is sent at most once an hour, so a bad day doesn't flood
// the inbox (Resend free tier = 100 emails/day).
//
// "Whole site down" can't be reported by the server itself (a dead server
// can't send email) — that's covered by the GitHub uptime check in
// .github/workflows/uptime.yml.
//
// The core (createWatch) is pure: clock and sender are injected, so it's
// unit-tested in tests/healthWatch.test.js without a DB or real email.

const MIN = 60 * 1000;

// Group "/api/appointments/66a1f…/pay?x=1" as "/api/appointments/:id/pay"
// so the email shows which feature is failing (and no ids or query data).
function routeKey(url) {
  return String(url || '')
    .split('?')[0]
    .replace(/\/[0-9a-f]{24}(?=\/|$)/gi, '/:id')
    .replace(/\/\d+(?=\/|$)/g, '/:n')
    .slice(0, 80);
}

function createWatch({
  now = () => Date.now(),
  send,
  threshold = 10,
  windowMs = 10 * MIN,
  cooldownMs = 60 * MIN,
  dbGraceMs = 3 * MIN,
} = {}) {
  let errors = []; // [{ at, route, code }]
  const lastSent = {}; // kind -> time
  let dbDownSince = null;
  let dbAlerted = false;

  const canSend = (kind) => !lastSent[kind] || now() - lastSent[kind] >= cooldownMs;
  const fire = (kind, subject, lines) => {
    lastSent[kind] = now();
    const html = `<p>${lines.map(escapeHtml).join('<br>')}</p>`
      + '<p style="color:#666;font-size:12px">Sent automatically by the ProMedicoz server (at most once an hour per problem). '
      + 'Check Render → docconnect-sg → Logs for details.</p>';
    try {
      Promise.resolve(send({ subject: `ProMedicoz alert: ${subject}`, html })).catch(() => {});
    } catch { /* an alert must never break a request */ }
    return { kind, subject };
  };

  // Call for every finished response. Returns the alert if one was sent.
  function recordStatus(code, url) {
    if (code < 500) return null;
    const t = now();
    errors.push({ at: t, route: routeKey(url), code });
    errors = errors.filter((e) => t - e.at <= windowMs);
    if (errors.length < threshold || !canSend('errors')) return null;
    const byRoute = {};
    for (const e of errors) byRoute[e.route] = (byRoute[e.route] || 0) + 1;
    const top = Object.entries(byRoute).sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([r, n]) => `• ${r} — ${n}`);
    return fire('errors', `${errors.length} server errors in ${Math.round(windowMs / MIN)} minutes`, [
      `The server returned ${errors.length} errors in the last ${Math.round(windowMs / MIN)} minutes. Patients or doctors may be seeing "Something went wrong".`,
      'Most affected:',
      ...top,
    ]);
  }

  // Call periodically with the current DB state. Returns the alert if sent.
  function checkDb(connected) {
    const t = now();
    if (connected) {
      dbDownSince = null;
      if (dbAlerted) {
        dbAlerted = false;
        return fire('db-up', 'database is back', ['The database connection is back. The site is working normally again.']);
      }
      return null;
    }
    if (dbDownSince === null) dbDownSince = t;
    if (!dbAlerted && t - dbDownSince >= dbGraceMs && canSend('db-down')) {
      dbAlerted = true;
      return fire('db-down', 'database disconnected', [
        `The server has lost its database connection for ${Math.round((t - dbDownSince) / MIN)} minutes. Logins, bookings and dashboards won't work until it's back.`,
        'The server keeps retrying by itself every 30 seconds. If this lasts: check MongoDB Atlas (cluster status, Network Access list) and MONGODB_URI on Render.',
        'You will get a "database is back" email when it recovers.',
      ]);
    }
    return null;
  }

  return { recordStatus, checkDb, _state: () => ({ errors: errors.length, dbDownSince, dbAlerted }) };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// ---- Live wiring (used by server.js) ----
let live = null;
function getLive() {
  if (!live) {
    const { sendEmail } = require('./sendEmail');
    const to = process.env.ADMIN_NOTIFY_EMAIL || process.env.ADMIN_EMAIL || 'support@promedicoz.in';
    live = createWatch({ send: ({ subject, html }) => sendEmail({ to, subject, html }) });
  }
  return live;
}

// Express middleware: counts 5xx responses.
function errorWatchMiddleware(req, res, next) {
  res.on('finish', () => {
    if (res.statusCode >= 500) getLive().recordStatus(res.statusCode, req.originalUrl);
  });
  next();
}

// Start the DB watcher (every 30 s).
function startDbWatch(isConnected) {
  const t = setInterval(() => getLive().checkDb(isConnected()), 30 * 1000);
  if (t.unref) t.unref();
  return t;
}

module.exports = { createWatch, routeKey, errorWatchMiddleware, startDbWatch };
