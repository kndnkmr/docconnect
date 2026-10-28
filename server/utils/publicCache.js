// ============================================
// Public cache — instant answers for public lists that everyone asks for
// ============================================
// The doctor list, city list, doctor profiles and free slots are public and
// identical for every visitor, but each costs several database lookups.
// This keeps the JSON answer in memory for a short time (30 s by default).
//
// Never stale where it matters: ANY successful change to appointments,
// availability, doctor profiles, reviews, accounts or admin data clears the
// whole cache at once (see invalidateOnWrites in server.js), so a booked
// slot disappears from the free-slots answer immediately. Booking also
// re-checks the slot on the server regardless.
//
// Only plain GETs without a login are cached (logged-in answers can differ
// per person). One server instance, in memory: nothing to set up.

const store = new Map(); // url → { at, body }
const MAX_ENTRIES = 300;

function cachePublic(ttlMs = 30 * 1000) {
  return (req, res, next) => {
    if (req.method !== 'GET' || req.headers.authorization) return next();
    const key = req.originalUrl;
    const hit = store.get(key);
    if (hit && Date.now() - hit.at < ttlMs) {
      res.set('X-Cache', 'HIT');
      return res.json(hit.body);
    }
    res.set('X-Cache', 'MISS');
    const json = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode === 200) {
        if (store.size >= MAX_ENTRIES) store.delete(store.keys().next().value); // drop oldest
        store.set(key, { at: Date.now(), body });
      }
      return json(body);
    };
    next();
  };
}

function invalidatePublic() {
  store.clear();
}

// Express middleware: after any successful write under these API areas,
// clear the cache.
const WRITE_AREAS = /^\/api\/(appointments|availability|doctors|admin|reviews|auth|family-members)\b/;
function invalidateOnWrites(req, res, next) {
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS' && WRITE_AREAS.test(req.path)) {
    res.on('finish', () => { if (res.statusCode < 400) invalidatePublic(); });
  }
  next();
}

module.exports = { cachePublic, invalidatePublic, invalidateOnWrites, _store: store };
