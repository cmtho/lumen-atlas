import crypto from 'node:crypto';

const isProduction = process.env.NODE_ENV === 'production';
if (isProduction && !process.env.ATLAS_SESSION_SECRET) {
  throw new Error('ATLAS_SESSION_SECRET is required when NODE_ENV=production. Generate one with: openssl rand -hex 32');
}
const SECRET = process.env.ATLAS_SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const COOKIE = 'atlas_user';
const MAX_AGE = 60 * 60 * 24 * 30;

function sign(payload) {
  return crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
}

export function createSessionToken(user) {
  const payload = Buffer.from(JSON.stringify({
    uid: user.id,
    username: user.username,
    role: user.role,
    sv: user.sessionVersion || 0,
    exp: Date.now() + MAX_AGE * 1000,
  })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token) {
  if (!token || !token.includes('.')) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.uid || !data.exp || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export function secureRequest(req) {
  return req.secure || req.get('x-forwarded-proto') === 'https' || process.env.ATLAS_SECURE_COOKIE === '1';
}

export function sessionCookie(req, user, clear = false) {
  const secure = secureRequest(req) ? '; Secure' : '';
  if (clear) return `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`;
  return `${COOKIE}=${createSessionToken(user)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${MAX_AGE}${secure}`;
}

export function cookieValue(req, name = COOKIE) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0 && part.slice(0, idx).trim() === name) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return null;
}

export { COOKIE, MAX_AGE };
