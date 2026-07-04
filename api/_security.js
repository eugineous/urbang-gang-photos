// Urban Gang Moments — shared upload guards
// This is a public UGC upload feature (no login system), so this is
// defense-in-depth rather than real authentication: it blocks drive-by
// cross-site abuse and generic internet-wide bots, not a targeted attacker
// who reads the client bundle. Combined with file-type/size checks it
// meaningfully cuts down on repo/storage abuse.

const ALLOWED_ORIGINS = new Set([
  'https://urbang-gang-photos.vercel.app',
]);

const ALLOWED_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic',
  'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska',
]);

const MEDIA_EXT = /\.(jpg|jpeg|png|gif|webp|heic|mp4|mov|avi|mkv)$/i;

// Best-effort per-instance rate limit. Serverless instances are ephemeral,
// so this doesn't stop a distributed attacker, but it caps burst abuse from
// a single warm instance/IP.
const hits = new Map();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 30;

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  return (Array.isArray(fwd) ? fwd[0] : fwd || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
}

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-App-Key');
}

function rejectIfBlocked(req, res) {
  const origin = req.headers.origin;
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    res.status(403).json({ error: 'Origin not allowed' });
    return true;
  }

  const key = req.headers['x-app-key'];
  if (!process.env.UPLOAD_APP_KEY || key !== process.env.UPLOAD_APP_KEY) {
    res.status(401).json({ error: 'Missing or invalid app key' });
    return true;
  }

  const ip = clientIp(req);
  const now = Date.now();
  const record = hits.get(ip);
  if (!record || now - record.start > WINDOW_MS) {
    hits.set(ip, { start: now, count: 1 });
  } else {
    record.count += 1;
    if (record.count > MAX_PER_WINDOW) {
      res.status(429).json({ error: 'Too many uploads, slow down' });
      return true;
    }
  }

  return false;
}

function isAllowedMedia(fileType, filename) {
  if (fileType && ALLOWED_TYPES.has(String(fileType).toLowerCase())) return true;
  return MEDIA_EXT.test(String(filename || ''));
}

export { applyCors, rejectIfBlocked, isAllowedMedia };
