import express from 'express';
import compression from 'compression';
import multer from 'multer';
import sharp from 'sharp';
import exifr from 'exifr';
import heicConvert from 'heic-convert';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  ROOT, DATA_DIR, UPLOAD_DIR, THUMB_DIR, ORIGINAL_DIR, AVATAR_DIR, TMP_DIR,
  loadDb, mutate, nextId, getDemoPhotosForUser, DEFAULT_SETTINGS,
} from './db.js';
import { hashPassword, verifyPassword, generateInviteCode, generatePassword } from './passwords.js';
import { sessionCookie, verifySessionToken, cookieValue, COOKIE as SESSION_COOKIE } from './session.js';
import { reverseGeocode, searchPlaces, aroundPois, setAmapKey, getAmapKey } from './geocode.js';
import { loadGeo, regionIndex, lookupRegionCenter, resolveChina } from './geo.js';
import { resolveCaptureTime, localWallFromDate, normalizeOffset } from './capture-time.js';

const PORT = Number(process.env.PORT || 8099);
const HOST = process.env.HOST || '0.0.0.0';
const DIST = path.join(ROOT, 'dist');
const app = express();

app.disable('x-powered-by');
app.set('trust proxy', process.env.ATLAS_TRUST_PROXY ?? 'loopback');
app.use(compression({ threshold: 1024 }));
app.use(express.json({ limit: '4mb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy-Report-Only', "default-src 'self'; img-src 'self' data: blob: https://*.autonavi.com https://*.openfreemap.org; connect-src 'self' https://*.autonavi.com https://*.openfreemap.org https://nominatim.openstreetmap.org https://restapi.amap.com; script-src 'self' 'unsafe-inline' https://webapi.amap.com; style-src 'self' 'unsafe-inline'; worker-src 'self' blob:; frame-ancestors 'none'");
  if (req.secure) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  const ext = path.extname(req.path).toLowerCase();
  if (req.method === 'GET' && !req.path.startsWith('/api/') && !req.path.startsWith('/media/') && (!ext || ext === '.html')) {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  }
  if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
  next();
});

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, TMP_DIR),
    filename: (req, file, cb) => cb(null, `${crypto.randomBytes(16).toString('hex')}.tmp`),
  }),
  limits: { fileSize: 50 * 1024 * 1024, files: 30, fieldSize: 8 * 1024 * 1024 },
});
const uploadAvatar = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
});

const loginAttempts = new Map();
const AVATAR_COLORS = ['#65f4ff', '#ffbd73', '#b79cff', '#7df0a8', '#ff8ea8', '#9fc4ff', '#f7e57d', '#ff9f62'];

function checkRate(key, max = 10, windowMs = 10 * 60 * 1000) {
  const now = Date.now();
  const rec = loginAttempts.get(key) || { count: 0, reset: now + windowMs };
  if (rec.reset < now) { rec.count = 0; rec.reset = now + windowMs; }
  if (rec.count >= max) return false;
  rec.count++;
  loginAttempts.set(key, rec);
  return true;
}

function clearRate(key) { loginAttempts.delete(key); }

setInterval(() => {
  const now = Date.now();
  for (const [key, rec] of loginAttempts) if (rec.reset < now) loginAttempts.delete(key);
}, 60 * 1000).unref();

const isHeic = (file) => /\.(heic|heif)$/i.test(file.originalname) || /hei[cf]/i.test(file.mimetype);
const imageExt = (file) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (/^\.(jpe?g|png|webp|gif|avif|tiff?|heic|heif)$/.test(ext)) return ext === '.jpeg' ? '.jpg' : ext;
  const map = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'image/avif': '.avif', 'image/tiff': '.tiff', 'image/heic': '.heic', 'image/heif': '.heif' };
  return map[file.mimetype] || '.img';
};

function safeText(value, max = 240) {
  if (value == null) return '';
  return String(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max);
}
function numberOrNull(value) {
  if (value === '' || value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function timestamp(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
function formatExposure(v) {
  if (!v) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n >= 1) return `${Number(n.toFixed(2))}s`;
  return `1/${Math.round(1 / n)}`;
}
function trimNum(v, digits = 1) {
  if (v == null || !Number.isFinite(Number(v))) return null;
  return Number(Number(v).toFixed(digits));
}

function sanitizeUsername(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
}

function accountOf(user) {
  return { id: user.id, username: user.username, role: user.role, createdAt: user.createdAt };
}

async function readExif(buffer) {
  try {
    const x = await exifr.parse(buffer, {
      tiff: true, exif: true, gps: true, ifd0: true, interop: true, iptc: true,
      translateValues: true, reviveValues: true,
    });
    if (!x) return {};
    let raw = null;
    try {
      raw = await exifr.parse(buffer, { tiff: true, exif: true, ifd0: true, translateValues: false, reviveValues: false });
    } catch {}
    let make = safeText(x.Make, 60);
    let model = safeText(x.Model, 80);
    if (make && model.toLowerCase().startsWith(make.toLowerCase())) model = model.slice(make.length).trim();
    return {
      dateTimeOriginal: raw?.DateTimeOriginal ?? null,
      offsetTimeOriginal: raw?.OffsetTimeOriginal ?? raw?.OffsetTime ?? raw?.OffsetTimeDigitized ?? null,
      createDate: raw?.CreateDate ?? null,
      modifyDate: raw?.ModifyDate ?? null,
      lat: Number.isFinite(x.latitude) ? x.latitude : null,
      lng: Number.isFinite(x.longitude) ? x.longitude : null,
      camera: [make, model].filter(Boolean).join(' ') || null,
      lens: safeText(x.LensModel || x.Lens, 100) || null,
      aperture: x.FNumber ? `f/${trimNum(x.FNumber, 1)}` : null,
      shutter: formatExposure(x.ExposureTime),
      iso: Number.isFinite(Number(x.ISO)) ? Number(x.ISO) : null,
      focalLength: x.FocalLength ? `${trimNum(x.FocalLength, 1)} mm` : null,
      width: x.ExifImageWidth || x.ImageWidth || null,
      height: x.ExifImageHeight || x.ImageHeight || null,
    };
  } catch {
    return {};
  }
}

async function prepareImage(file) {
  const id = crypto.randomBytes(9).toString('base64url');
  let input = file.path;
  let convertedHeic = false;
  if (isHeic(file)) {
    // TODO: prefer sharp's native HEIF decoder when available, and only fall back
    // to heic-convert on failure. Kept as-is for this batch.
    try {
      input = Buffer.from(await heicConvert({ buffer: await fs.readFile(file.path), format: 'JPEG', quality: 0.92 }));
      convertedHeic = true;
    } catch {
      const err = new Error('HEIC 解码失败，请在手机设置中将照片导出为 JPEG 后重试。');
      err.status = 422;
      throw err;
    }
  }
  const image = sharp(input, { failOn: 'none' }).rotate();
  try { await image.metadata(); } catch {
    const err = new Error('无法读取这张图片，请确认文件是有效的 JPEG / PNG / WebP / HEIC。');
    err.status = 422;
    throw err;
  }
  const ext = convertedHeic ? '.jpg' : imageExt(file);
  const originalName = `${id}${ext}`;
  const fullName = `${id}.webp`;
  const thumbName = `${id}.webp`;
  const [full, thumb] = await Promise.all([
    image.clone().resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true }).webp({ quality: 88, effort: 4 }).toBuffer({ resolveWithObject: true }),
    image.clone().resize({ width: 760, height: 760, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82, effort: 4 }).toBuffer({ resolveWithObject: true }),
  ]);
  const originalPath = path.join(ORIGINAL_DIR, originalName);
  await Promise.all([
    fs.writeFile(path.join(UPLOAD_DIR, fullName), full.data),
    fs.writeFile(path.join(THUMB_DIR, thumbName), thumb.data),
    convertedHeic ? fs.writeFile(originalPath, input) : fs.copyFile(file.path, originalPath),
  ]);
  return { id, originalName, fullName, thumbName, width: full.info.width, height: full.info.height, originalBytes: file.size };
}

async function removePreparedFiles(prepared) {
  if (!prepared) return;
  await Promise.all([
    fs.unlink(path.join(UPLOAD_DIR, prepared.fullName)).catch(() => {}),
    fs.unlink(path.join(THUMB_DIR, prepared.thumbName)).catch(() => {}),
    fs.unlink(path.join(ORIGINAL_DIR, prepared.originalName)).catch(() => {}),
  ]);
}

async function runWithLimit(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function runner() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runner));
  return results;
}

function uploadedFiles(req) {
  if (Array.isArray(req.files)) return req.files;
  if (req.files && typeof req.files === 'object') return Object.values(req.files).flat();
  return req.file ? [req.file] : [];
}

async function cleanupUploadedFiles(req) {
  const files = uploadedFiles(req).filter(file => file?.path);
  await Promise.allSettled(files.map(file => fs.unlink(file.path)));
}

function normalizePhotoInput(meta, exif, file, prepared, people, userId) {
  const owned = new Set(people.map(p => p.id));
  const personIds = Array.isArray(meta.personIds) ? meta.personIds.filter(id => owned.has(id)) : [];
  let lat = numberOrNull(meta.lat) ?? exif.lat ?? null;
  let lng = numberOrNull(meta.lng) ?? exif.lng ?? null;
  let country = safeText(meta.country, 80);
  let countryCode = safeText(meta.countryCode, 8).toLowerCase();
  let province = safeText(meta.province, 60);
  let city = safeText(meta.city, 60);
  let district = safeText(meta.district, 60);
  const locationName = safeText(meta.locationName, 160);
  if (lat == null || lng == null) {
    const reg = lookupRegionCenter(province, city, district);
    if (reg?.center) { lng = reg.center[0]; lat = reg.center[1]; }
  }
  const manualLike = meta.date && (meta.dateSource === 'manual' || meta.dateSource === 'file' || !meta.dateSource);
  const manualDate = manualLike ? timestamp(meta.date) : null;
  let capture;
  if (manualDate) {
    const rawLocal = safeText(meta.capturedLocal, 19);
    const local = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(rawLocal)
      ? `${rawLocal}${rawLocal.length === 16 ? ':00' : ''}`
      : localWallFromDate(manualDate);
    capture = { capturedAt: manualDate, capturedLocal: local, tzOffset: normalizeOffset(meta.tzOffset), dateSource: meta.dateSource === 'file' ? 'file' : 'manual' };
  } else {
    // 没有 EXIF 时间时不要伪造“现在”：单文件且无 metadata 的情况下，
    // capturedAt / capturedLocal 会留空，前端显示“未知日期”，这是有意行为。
    capture = resolveCaptureTime(exif, file.lastModified);
  }
  const baseName = path.basename(file.originalname, path.extname(file.originalname));
  const dimensions = prepared.width && prepared.height ? `${prepared.width} × ${prepared.height}` : meta.dimensions || '';
  return {
    id: prepared.id,
    userId,
    demo: false,
    title: safeText(meta.title, 120) || baseName || '未命名影像',
    image: `/media/uploads/${prepared.fullName}`,
    thumb: `/media/thumbs/${prepared.thumbName}`,
    original: `/media/originals/${prepared.originalName}`,
    capturedAt: capture.capturedAt,
    capturedLocal: capture.capturedLocal,
    tzOffset: capture.tzOffset,
    dateSource: capture.dateSource,
    country, countryCode, province, city, district,
    locationName: locationName || district || city || province || country,
    lat, lng, personIds,
    tags: Array.isArray(meta.tags) ? meta.tags.map(t => safeText(t, 24)).filter(Boolean).slice(0, 12) : safeText(meta.tags, 200).split(/[,，]/).map(t => t.trim()).filter(Boolean).slice(0, 12),
    notes: safeText(meta.notes, 2000),
    camera: safeText(meta.camera, 100) || exif.camera || '',
    lens: safeText(meta.lens, 100) || exif.lens || '',
    aperture: safeText(meta.aperture, 24) || exif.aperture || '',
    shutter: safeText(meta.shutter, 24) || exif.shutter || '',
    iso: numberOrNull(meta.iso) ?? exif.iso ?? null,
    focalLength: safeText(meta.focalLength, 24) || exif.focalLength || '',
    dimensions: safeText(meta.dimensions, 40) || dimensions,
    fileSize: prepared.originalBytes,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

async function fillLocationFallback(photo) {
  if (photo.lat == null || photo.lng == null) return photo;
  if (photo.countryCode && photo.province) return photo;
  try {
    const geo = await reverseGeocode(photo.lat, photo.lng);
    if (!photo.country) photo.country = geo.country || '';
    if (!photo.countryCode) photo.countryCode = geo.countryCode || '';
    if (!photo.province) photo.province = geo.province || '';
    if (!photo.city) photo.city = geo.city || '';
    if (!photo.district) photo.district = geo.district || '';
    if (!photo.locationName) photo.locationName = geo.locationName || '';
  } catch {}
  return photo;
}

async function getSessionUser(req, db = null) {
  const token = cookieValue(req, SESSION_COOKIE);
  const payload = verifySessionToken(token);
  if (!payload) return null;
  const database = db || await loadDb();
  const user = database.users.find(u => u.id === payload.uid);
  if (!user || user.disabled || (user.sessionVersion || 0) !== payload.sv) return null;
  return user;
}

async function requireAuth(req, res, next) {
  try {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ error: '请先登录', authRequired: true });
    req.user = user;
    next();
  } catch (e) { next(e); }
}

function inviteView(invite, db) {
  return {
    id: invite.id,
    code: invite.code,
    createdAt: invite.createdAt,
    expiresAt: invite.expiresAt,
    maxUses: invite.maxUses || 1,
    uses: invite.uses || 0,
    revokedAt: invite.revokedAt || null,
    usedBy: (invite.usedBy || []).map(id => db.users.find(u => u.id === id)?.username).filter(Boolean),
    active: !invite.revokedAt && (invite.uses || 0) < (invite.maxUses || 1) && new Date(invite.expiresAt) > new Date(),
  };
}

function publicSite(db) {
  const s = db.settings || {};
  return {
    siteName: s.siteName || DEFAULT_SETTINGS.siteName,
    tagline: s.tagline || DEFAULT_SETTINGS.tagline,
    description: s.description || DEFAULT_SETTINGS.description,
  };
}

function normalizeTrackStops(value) {
  if (!Array.isArray(value) || value.length < 2) return { error: '轨迹至少需要两个地点' };
  if (value.length > 50) return { error: '轨迹最多支持 50 个地点' };
  const stops = [];
  for (const item of value) {
    const name = safeText(item?.name, 80);
    if (!name) return { error: '地点名称不能为空' };
    const lng = Number(item?.lng);
    const lat = Number(item?.lat);
    if (item?.lng == null || item?.lat == null || item?.lng === '' || item?.lat === '' || !Number.isFinite(lng) || !Number.isFinite(lat) || lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      return { error: '坐标不合法' };
    }
    const at = safeText(item?.at, 40);
    if (!at || Number.isNaN(Date.parse(at))) return { error: '地点时间不合法' };
    stops.push({ name, lng, lat, at });
  }
  return { stops };
}

function publicDb(db, user) {
  const people = db.people.filter(p => p.userId === user.id);
  const photos = db.photos.filter(p => p.userId === user.id);
  const invites = db.invites.filter(i => i.createdBy === user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(i => inviteView(i, db));
  return {
    revision: user.profile?.updatedAt || user.updatedAt,
    profile: user.profile,
    account: accountOf(user),
    site: publicSite(db),
    people,
    photos,
    invites,
    tracks: db.tracks.filter(t => t.userId === user.id),
    meta: {
      mapProvider: 'OpenFreeMap',
      amapKey: getAmapKey(),
      amapEnabled: !!getAmapKey(),
      mapData: 'OpenStreetMap',
      keyRequired: false,
      geocoder: 'AMap + Nominatim + DataV 行政区划',
      authEnabled: true,
      inviteRequired: db.users.length > 0,
      demoEnabled: user.role === 'owner',
      serverTime: new Date().toISOString(),
    },
  };
}

/* ---------- public auth ---------- */
app.get('/api/health', (req, res) => {
  res.json({ ok: true, app: 'lumen-atlas', version: '1.1.0', uptime: Math.round(process.uptime()) });
});

app.get('/api/auth/status', async (req, res) => {
  const db = await loadDb();
  const user = await getSessionUser(req, db);
  res.json({
    needsSetup: db.users.length === 0,
    inviteRequired: db.users.length > 0,
    authenticated: !!user,
    user: user ? accountOf(user) : null,
    site: publicSite(db),
  });
});

app.post('/api/auth/register', async (req, res) => {
  const username = sanitizeUsername(req.body?.username);
  const password = String(req.body?.password || '');
  const displayName = safeText(req.body?.displayName, 40);
  const code = String(req.body?.inviteCode || '').trim().toUpperCase();
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  if (!checkRate(`register:${ip}`, 12)) return res.status(429).json({ error: '尝试次数过多，请稍后再试' });
  if (username.length < 3 || username.length > 24) return res.status(400).json({ error: '用户名需要 3–24 位，只能使用字母、数字、_、-' });
  if (password.length < 8 || password.length > 128) return res.status(400).json({ error: '密码至少 8 位' });

  const db = await loadDb();
  if (db.users.length === 0) return res.status(409).json({ error: '请先完成站点初始化', setupRequired: true });
  const needsSetup = false;
  if (db.users.some(u => u.username.toLowerCase() === username)) return res.status(409).json({ error: '用户名已被使用' });
  if (!needsSetup && !code) return res.status(400).json({ error: '需要邀请码' });

  const pwd = hashPassword(password);
  let createdUser;
  try {
    const result = await mutate(database => {
      if (database.users.length === 0) {
        // first account is owner
      } else if (database.users.some(u => u.username.toLowerCase() === username)) {
        const e = new Error('用户名已被使用'); e.status = 409; throw e;
      }
      let invite = null;
      if (database.users.length > 0) {
        invite = database.invites.find(i => i.code.toUpperCase() === code);
        const creator = invite ? database.users.find(u => u.id === invite.createdBy) : null;
        if (!invite || !creator || creator.disabled || invite.revokedAt || (invite.uses || 0) >= (invite.maxUses || 1) || new Date(invite.expiresAt) <= new Date()) {
          const e = new Error('邀请码无效、已使用或已过期'); e.status = 403; throw e;
        }
      }
      const user = {
        id: nextId('u'),
        username,
        passwordHash: pwd.hash,
        passwordSalt: pwd.salt,
        role: database.users.length === 0 ? 'owner' : 'member',
        sessionVersion: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        profile: {
          name: displayName || username,
          handle: username.toUpperCase(),
          bio: '刚刚接入了 LUMEN ATLAS。',
          home: '',
          avatarColor: AVATAR_COLORS[database.users.length % AVATAR_COLORS.length],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };
      database.users.push(user);
      if (invite) {
        invite.uses = (invite.uses || 0) + 1;
        invite.usedBy = [...(invite.usedBy || []), user.id];
      }
      createdUser = user;
      return user;
    });
    clearRate(`register:${ip}`);
    res.setHeader('Set-Cookie', sessionCookie(req, result));
    res.status(201).json({ ok: true, user: accountOf(result), profile: result.profile });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || '注册失败' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const username = sanitizeUsername(req.body?.username);
  const password = String(req.body?.password || '');
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  if (!checkRate(`login-ip:${ip}`, 10, 10 * 60 * 1000)) return res.status(429).json({ error: '尝试次数过多，请十分钟后再试' });
  if (!checkRate(`login:${ip}:${username}`, 10)) return res.status(429).json({ error: '尝试次数过多，请十分钟后再试' });
  const db = await loadDb();
  const user = db.users.find(u => u.username.toLowerCase() === username);
  if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
    return res.status(401).json({ error: '用户名或密码不正确' });
  }
  if (user.disabled) return res.status(403).json({ error: '账号已被禁用，请联系主人账号' });
  clearRate(`login:${ip}:${username}`);
  const updated = await mutate(db => {
    const u = db.users.find(x => x.id === user.id);
    u.lastLoginAt = new Date().toISOString();
    return u;
  });
  res.setHeader('Set-Cookie', sessionCookie(req, updated));
  res.json({ ok: true, user: accountOf(updated), profile: updated.profile });
});

app.post('/api/auth/logout', (req, res) => {
  res.setHeader('Set-Cookie', [sessionCookie(req, null, true), 'atlas_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0']);
  res.json({ ok: true });
});

app.post('/api/setup', async (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  if (!checkRate(`setup:${ip}`, 8)) return res.status(429).json({ error: '尝试次数过多，请稍后再试' });
  const username = sanitizeUsername(req.body?.username);
  const password = String(req.body?.password || '');
  const displayName = safeText(req.body?.displayName, 40);
  if (username.length < 3 || username.length > 24) return res.status(400).json({ error: '用户名需要 3–24 位，只能使用字母、数字、_、-' });
  if (password.length < 8 || password.length > 128) return res.status(400).json({ error: '密码至少 8 位' });
  const db = await loadDb();
  if (db.users.length > 0) return res.status(409).json({ error: '站点已经完成初始化' });
  const pwd = hashPassword(password);
  const settings = {
    siteName: safeText(req.body?.siteName, 40) || DEFAULT_SETTINGS.siteName,
    tagline: safeText(req.body?.tagline, 80) || DEFAULT_SETTINGS.tagline,
    description: safeText(req.body?.description, 200) || DEFAULT_SETTINGS.description,
    amapKey: safeText(req.body?.amapKey, 64),
  };
  try {
    const result = await mutate(database => {
      if (database.users.length > 0) {
        const e = new Error('站点已经完成初始化'); e.status = 409; throw e;
      }
      if (database.users.some(u => u.username.toLowerCase() === username)) {
        const e = new Error('用户名已被使用'); e.status = 409; throw e;
      }
      const user = {
        id: nextId('u'),
        username,
        passwordHash: pwd.hash,
        passwordSalt: pwd.salt,
        role: 'owner',
        sessionVersion: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        profile: {
          name: displayName || username,
          handle: username.toUpperCase(),
          bio: '在地球的褶皱里，收集光与坐标。',
          home: '',
          avatarColor: '#65f4ff',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };
      database.users.push(user);
      database.settings = { ...DEFAULT_SETTINGS, ...settings };
      return { user, settings: database.settings };
    });
    setAmapKey(result.settings.amapKey);
    clearRate(`setup:${ip}`);
    res.setHeader('Set-Cookie', sessionCookie(req, result.user));
    res.status(201).json({ ok: true, user: accountOf(result.user), profile: result.user.profile, site: publicSite({ settings: result.settings }) });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || '初始化失败' });
  }
});

/* ---------- protected API ---------- */
app.use('/api', async (req, res, next) => {
  const publicApi = new Set(['/health', '/auth/status', '/auth/register', '/auth/login', '/auth/logout']);
  if (publicApi.has(req.path)) return next();
  return requireAuth(req, res, next);
});

app.post('/api/auth/password', async (req, res, next) => {
  try {
    const current = String(req.body?.currentPassword || '');
    const nextPassword = String(req.body?.newPassword || '');
    if (nextPassword.length < 8 || nextPassword.length > 128) return res.status(400).json({ error: '新密码至少 8 位' });
    const db = await loadDb();
    const user = db.users.find(u => u.id === req.user.id);
    if (!user || !verifyPassword(current, user.passwordSalt, user.passwordHash)) return res.status(403).json({ error: '当前密码不正确' });
    const pwd = hashPassword(nextPassword);
    const updated = await mutate(database => {
      const u = database.users.find(x => x.id === req.user.id);
      u.passwordHash = pwd.hash;
      u.passwordSalt = pwd.salt;
      u.sessionVersion = (u.sessionVersion || 0) + 1;
      u.updatedAt = new Date().toISOString();
      return u;
    });
    res.setHeader('Set-Cookie', sessionCookie(req, updated));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

app.get('/api/bootstrap', async (req, res) => {
  await loadGeo();
  const db = await loadDb();
  res.json({ ...publicDb(db, req.user), regions: regionIndex() });
});

app.get('/api/invites', async (req, res) => {
  const db = await loadDb();
  res.json({ invites: db.invites.filter(i => i.createdBy === req.user.id).map(i => inviteView(i, db)) });
});

app.post('/api/invites', async (req, res) => {
  const requestedDays = Number(req.body?.expiresDays);
  const requestedUses = Number(req.body?.maxUses);
  const expiresDays = Math.min(365, Math.max(1, Math.round(Number.isFinite(requestedDays) ? requestedDays : 14)));
  const maxUses = Math.min(100, Math.max(1, Math.round(Number.isFinite(requestedUses) ? requestedUses : 1)));
  const invite = await mutate(db => {
    let code = generateInviteCode();
    while (db.invites.some(i => i.code === code)) code = generateInviteCode();
    const item = {
      id: nextId('inv'),
      code,
      createdBy: req.user.id,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * expiresDays).toISOString(),
      maxUses,
      uses: 0,
      usedBy: [],
      revokedAt: null,
    };
    db.invites.push(item);
    return item;
  });
  const db = await loadDb();
  res.status(201).json({ invite: inviteView(invite, db) });
});

app.delete('/api/invites/:id', async (req, res) => {
  const result = await mutate(db => {
    const invite = db.invites.find(i => i.id === req.params.id && i.createdBy === req.user.id);
    if (!invite) return null;
    if ((invite.uses || 0) >= (invite.maxUses || 1)) return { used: true };
    invite.revokedAt = new Date().toISOString();
    return { used: false };
  });
  if (!result) return res.status(404).json({ error: '邀请码不存在' });
  if (result.used) return res.status(400).json({ error: '已使用的邀请码不能撤销' });
  res.json({ ok: true });
});

app.get('/api/photos', async (req, res) => {
  const db = await loadDb();
  res.json({ photos: db.photos.filter(p => p.userId === req.user.id) });
});

app.post('/api/photos', upload.array('files', 30), async (req, res, next) => {
  try {
    if (!req.files?.length) return res.status(400).json({ error: '请选择至少一张照片。' });
    let metas = [];
    try {
      metas = JSON.parse(req.body.metadata || '[]');
    } catch {
      await cleanupUploadedFiles(req);
      return res.status(400).json({ error: 'metadata 不是合法的 JSON' });
    }
    if (!Array.isArray(metas)) metas = [];
    if (req.files.length > 1 && metas.length < req.files.length) {
      await cleanupUploadedFiles(req);
      return res.status(400).json({ error: '照片元数据数量与文件数量不一致，请从上传页面重新提交' });
    }
    const db = await loadDb();
    const people = db.people.filter(p => p.userId === req.user.id);

    const results = await runWithLimit(req.files, 2, async (file, index) => {
      let prepared = null;
      try {
        file.lastModified = Number(metas[index]?.lastModified) || file.lastModified;
        const exif = await readExif(await fs.readFile(file.path));
        prepared = await prepareImage(file);
        let photo = normalizePhotoInput(
          metas[index] && typeof metas[index] === 'object' ? metas[index] : {},
          exif, file, prepared, people, req.user.id,
        );
        photo = await fillLocationFallback(photo);
        if ((!photo.province || !photo.city) && photo.lat != null && photo.lng != null) {
          try {
            const reg = await resolveChina(photo.lat, photo.lng);
            if (reg) {
              if (!photo.province) photo.province = reg.province;
              if (!photo.city) photo.city = reg.city;
              if (!photo.district) photo.district = reg.district;
              if (!photo.country) photo.country = reg.country;
              if (!photo.countryCode) photo.countryCode = reg.countryCode;
              if (!photo.locationName) photo.locationName = reg.district || reg.city || reg.province;
            }
          } catch {}
        }
        return { photo };
      } catch (e) {
        await removePreparedFiles(prepared);
        return { failure: { file: file.originalname, reason: e.message || '处理失败' } };
      } finally {
        await fs.unlink(file.path).catch(() => {});
      }
    });

    const photos = results.filter(r => r.photo).map(r => r.photo);
    const failures = results.filter(r => r.failure).map(r => r.failure);
    let total;
    if (photos.length) {
      total = await mutate(database => {
        database.photos.unshift(...photos);
        return database.photos.filter(p => p.userId === req.user.id).length;
      });
    } else {
      total = (await loadDb()).photos.filter(p => p.userId === req.user.id).length;
    }
    res.status(201).json({ photos, total, failures });
  } catch (e) {
    await cleanupUploadedFiles(req);
    next(e);
  }
});

app.patch('/api/photos/:id', async (req, res) => {
  const result = await mutate(db => {
    const photo = db.photos.find(p => p.id === req.params.id && p.userId === req.user.id);
    if (!photo) return null;
    const b = req.body || {};
    const textFields = ['title', 'country', 'countryCode', 'province', 'city', 'district', 'locationName', 'notes', 'camera', 'lens', 'aperture', 'shutter', 'focalLength', 'dimensions'];
    for (const key of textFields) if (key in b) photo[key] = safeText(b[key], key === 'notes' ? 2000 : 160);
    if ('capturedAt' in b) {
      const d = timestamp(b.capturedAt);
      if (d) {
        photo.capturedAt = d;
        photo.capturedLocal = safeText(b.capturedLocal, 19) || localWallFromDate(d);
        photo.tzOffset = normalizeOffset(b.tzOffset);
        photo.dateSource = b.dateSource || 'manual';
      }
    }
    if ('dateSource' in b && ['exif', 'exif-local', 'file', 'manual'].includes(b.dateSource)) photo.dateSource = b.dateSource;
    if ('lat' in b) photo.lat = numberOrNull(b.lat);
    if ('lng' in b) photo.lng = numberOrNull(b.lng);
    if ('iso' in b) photo.iso = numberOrNull(b.iso);
    if ('personIds' in b) {
      const owned = new Set(db.people.filter(p => p.userId === req.user.id).map(p => p.id));
      photo.personIds = Array.isArray(b.personIds) ? b.personIds.filter(id => owned.has(id)) : [];
    }
    if ('tags' in b) photo.tags = Array.isArray(b.tags) ? b.tags.map(t => safeText(t, 24)).filter(Boolean).slice(0, 12) : [];
    if ((photo.lat == null || photo.lng == null) && (photo.province || photo.city || photo.district)) {
      const reg = lookupRegionCenter(photo.province, photo.city, photo.district);
      if (reg?.center) { photo.lng = reg.center[0]; photo.lat = reg.center[1]; }
    }
    photo.updatedAt = new Date().toISOString();
    return { ...photo };
  });
  if (!result) return res.status(404).json({ error: '影像不存在' });
  res.json({ photo: result });
});

async function removeMedia(photo) {
  if (!photo || photo.demo) return;
  for (const [url, dir] of [[photo.image, UPLOAD_DIR], [photo.thumb, THUMB_DIR], [photo.original, ORIGINAL_DIR]]) {
    if (!url) continue;
    const name = path.basename(url);
    if (!name || name === '.' || name === '..') continue;
    try { await fs.unlink(path.join(dir, name)); } catch {}
  }
}

app.delete('/api/photos/:id', async (req, res) => {
  const removed = await mutate(db => {
    const idx = db.photos.findIndex(p => p.id === req.params.id && p.userId === req.user.id);
    if (idx < 0) return null;
    return db.photos.splice(idx, 1)[0];
  });
  if (!removed) return res.status(404).json({ error: '影像不存在' });
  await removeMedia(removed);
  res.json({ ok: true });
});

app.get('/api/tracks', async (req, res) => {
  const db = await loadDb();
  const tracks = db.tracks
    .filter(t => t.userId === req.user.id)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  res.json({ tracks });
});

app.post('/api/tracks', async (req, res) => {
  const b = req.body || {};
  const title = safeText(b.title, 60) || '未命名轨迹';
  const parsed = normalizeTrackStops(b.stops);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const now = new Date().toISOString();
  const track = {
    id: nextId('trk'),
    userId: req.user.id,
    title,
    stops: parsed.stops,
    color: /^#[0-9a-f]{6}$/i.test(b.color || '') ? b.color : '#65f4ff',
    notes: safeText(b.notes, 2000),
    createdAt: now,
    updatedAt: now,
  };
  await mutate(db => { db.tracks.push(track); });
  res.status(201).json({ track });
});

app.patch('/api/tracks/:id', async (req, res) => {
  const b = req.body || {};
  const parsed = 'stops' in b ? normalizeTrackStops(b.stops) : null;
  const current = await loadDb();
  if (!current.tracks.some(t => t.id === req.params.id && t.userId === req.user.id)) {
    return res.status(404).json({ error: '轨迹不存在' });
  }
  if (parsed?.error) return res.status(400).json({ error: parsed.error });
  const updated = await mutate(db => {
    const track = db.tracks.find(t => t.id === req.params.id && t.userId === req.user.id);
    if (!track) return null;
    if ('title' in b) track.title = safeText(b.title, 60) || '未命名轨迹';
    if (parsed) track.stops = parsed.stops;
    if ('color' in b) track.color = /^#[0-9a-f]{6}$/i.test(b.color || '') ? b.color : '#65f4ff';
    if ('notes' in b) track.notes = safeText(b.notes, 2000);
    track.updatedAt = new Date().toISOString();
    return { track };
  });
  if (!updated) return res.status(404).json({ error: '轨迹不存在' });
  res.json({ track: updated.track });
});

app.delete('/api/tracks/:id', async (req, res) => {
  const removed = await mutate(db => {
    const idx = db.tracks.findIndex(t => t.id === req.params.id && t.userId === req.user.id);
    if (idx < 0) return null;
    return db.tracks.splice(idx, 1)[0];
  });
  if (!removed) return res.status(404).json({ error: '轨迹不存在' });
  res.json({ ok: true });
});

app.post('/api/people', async (req, res) => {
  const name = safeText(req.body?.name, 30);
  if (!name) return res.status(400).json({ error: '请输入人物名称' });
  const person = {
    id: nextId('p'),
    userId: req.user.id,
    name,
    color: /^#[0-9a-f]{6}$/i.test(req.body?.color || '') ? req.body.color : '#65f4ff',
    note: safeText(req.body?.note, 120),
    createdAt: new Date().toISOString(),
  };
  await mutate(db => db.people.push(person));
  res.status(201).json({ person });
});

app.patch('/api/people/:id', async (req, res) => {
  const result = await mutate(db => {
    const p = db.people.find(x => x.id === req.params.id && x.userId === req.user.id);
    if (!p) return null;
    if ('name' in req.body) p.name = safeText(req.body.name, 30) || p.name;
    if ('note' in req.body) p.note = safeText(req.body.note, 120);
    if ('color' in req.body && /^#[0-9a-f]{6}$/i.test(req.body.color || '')) p.color = req.body.color;
    return { ...p };
  });
  if (!result) return res.status(404).json({ error: '人物不存在' });
  res.json({ person: result });
});

app.delete('/api/people/:id', async (req, res) => {
  const result = await mutate(db => {
    const idx = db.people.findIndex(x => x.id === req.params.id && x.userId === req.user.id);
    if (idx < 0) return null;
    const [p] = db.people.splice(idx, 1);
    for (const photo of db.photos.filter(x => x.userId === req.user.id)) photo.personIds = photo.personIds.filter(id => id !== p.id);
    return p;
  });
  if (!result) return res.status(404).json({ error: '人物不存在' });
  res.json({ ok: true });
});

app.patch('/api/profile', async (req, res) => {
  const profile = await mutate(db => {
    const user = db.users.find(u => u.id === req.user.id);
    const p = user.profile;
    for (const key of ['name', 'handle', 'bio', 'home']) if (key in req.body) p[key] = safeText(req.body[key], key === 'bio' ? 400 : 80);
    if ('avatarColor' in req.body && /^#[0-9a-f]{6}$/i.test(req.body.avatarColor || '')) p.avatarColor = req.body.avatarColor;
    p.updatedAt = new Date().toISOString();
    user.updatedAt = p.updatedAt;
    return { ...p };
  });
  res.json({ profile });
});

app.get('/api/geocode/reverse', async (req, res) => {
  try {
    const lat = Number(req.query.lat), lng = Number(req.query.lng ?? req.query.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return res.status(400).json({ error: '坐标无效' });
    res.json(await reverseGeocode(lat, lng));
  } catch (e) {
    res.status(502).json({ error: '逆地理编码暂时不可用', detail: e.message });
  }
});

app.get('/api/amap/pois', async (req, res) => {
  const lat = Number(req.query.lat), lng = Number(req.query.lng), zoom = Number(req.query.zoom);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return res.status(400).json({ error: '坐标无效' });
  res.json({ pois: await aroundPois(lat, lng, zoom) });
});

app.get('/api/geocode/search', async (req, res) => {
  res.json({ results: await searchPlaces(req.query.q) });
});

app.get('/api/export', async (req, res) => {
  const db = await loadDb();
  const user = db.users.find(u => u.id === req.user.id);
  const payload = {
    exportedAt: new Date().toISOString(),
    account: accountOf(user),
    profile: user.profile,
    people: db.people.filter(p => p.userId === user.id),
    photos: db.photos.filter(p => p.userId === user.id),
  };
  res.setHeader('Content-Disposition', `attachment; filename="lumen-atlas-${user.username}-${new Date().toISOString().slice(0, 10)}.json"`);
  res.type('application/json').send(JSON.stringify(payload, null, 2));
});

app.post('/api/demo/clear', async (req, res) => {
  if (req.user.role !== 'owner') return res.status(403).json({ error: '仅主人账号可以管理示例档案' });
  const removed = await mutate(db => {
    const before = db.photos.length;
    db.photos = db.photos.filter(p => !(p.userId === req.user.id && p.demo));
    return before - db.photos.length;
  });
  res.json({ ok: true, removed });
});

app.post('/api/demo/restore', async (req, res) => {
  if (req.user.role !== 'owner') return res.status(403).json({ error: '仅主人账号可以管理示例档案' });
  const added = await mutate(db => {
    const user = db.users.find(u => u.id === req.user.id);
    const people = db.people.filter(p => p.userId === req.user.id);
    const existing = new Set(db.photos.filter(p => p.userId === req.user.id).map(p => p.id));
    const demo = getDemoPhotosForUser(user, people).filter(p => !existing.has(p.id));
    db.photos.unshift(...demo);
    return demo.length;
  });
  res.json({ ok: true, added });
});

/* ---------- owner admin ---------- */
app.use('/api/admin', (req, res, next) => {
  if (!['owner', 'admin'].includes(req.user.role)) return res.status(403).json({ error: '需要管理员权限' });
  next();
});

app.get('/api/admin/settings', (req, res) => {
  if (req.user.role !== 'owner') return res.status(403).json({ error: '仅主人账号可以修改站点设置' });
  loadDb().then(db => res.json({
    settings: { ...publicSite(db), amapKey: db.settings?.amapKey || '' },
    amapFromEnv: !db.settings?.amapKey && !!process.env.AMAP_KEY,
  }));
});

app.patch('/api/admin/settings', async (req, res) => {
  if (req.user.role !== 'owner') return res.status(403).json({ error: '仅主人账号可以修改站点设置' });
  try {
    const updated = await mutate(db => {
      db.settings = {
        ...DEFAULT_SETTINGS,
        ...(db.settings || {}),
        siteName: safeText(req.body?.siteName, 40) || DEFAULT_SETTINGS.siteName,
        tagline: safeText(req.body?.tagline, 80) || DEFAULT_SETTINGS.tagline,
        description: safeText(req.body?.description, 200) || DEFAULT_SETTINGS.description,
        amapKey: safeText(req.body?.amapKey, 64),
      };
      return db.settings;
    });
    setAmapKey(updated.amapKey);
    res.json({ settings: { ...publicSite({ settings: updated }), amapKey: updated.amapKey }, amapFromEnv: !updated.amapKey && !!process.env.AMAP_KEY });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || '保存失败' });
  }
});

async function dirSize(dir) {
  let total = 0;
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) total += await dirSize(p);
      else { try { total += (await fs.stat(p)).size; } catch {} }
    }
  } catch {}
  return total;
}

app.get('/api/admin/overview', async (req, res) => {
  const db = await loadDb();
  const [uploads, thumbs, originals, dbStat] = await Promise.all([
    dirSize(UPLOAD_DIR), dirSize(THUMB_DIR), dirSize(ORIGINAL_DIR), fs.stat(path.join(DATA_DIR, 'db.json')).catch(() => ({ size: 0 })),
  ]);
  const usedInvites = db.invites.filter(i => (i.uses || 0) >= (i.maxUses || 1)).length;
  const activeInvites = db.invites.filter(i => !i.revokedAt && (i.uses || 0) < (i.maxUses || 1) && new Date(i.expiresAt) > new Date()).length;
  res.json({
    users: { total: db.users.length, active: db.users.filter(u => !u.disabled).length, disabled: db.users.filter(u => u.disabled).length },
    photos: db.photos.length,
    people: db.people.length,
    invites: { total: db.invites.length, active: activeInvites, used: usedInvites },
    storage: { uploads, thumbs, originals, database: dbStat.size, total: uploads + thumbs + originals + dbStat.size },
    recentUsers: [...db.users].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5).map(u => ({
      ...accountOf(u), name: u.profile?.name || u.username, avatarColor: u.profile?.avatarColor || '#65f4ff', avatarUrl: u.profile?.avatarUrl || null,
      photos: db.photos.filter(p => p.userId === u.id).length, disabled: !!u.disabled, createdAt: u.createdAt, lastLoginAt: u.lastLoginAt || null,
    })),
    recentPhotos: [...db.photos].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 8).map(p => ({
      id: p.id, title: p.title, thumb: p.thumb, capturedAt: p.capturedAt || null, capturedLocal: p.capturedLocal || null, createdAt: p.createdAt, username: db.users.find(u => u.id === p.userId)?.username || 'unknown',
    })),
    system: { uptime: Math.round(process.uptime()), node: process.version, amapEnabled: !!getAmapKey(), mapProvider: 'OpenFreeMap', auth: 'invite-only' },
  });
});

app.get('/api/admin/users', async (req, res) => {
  const db = await loadDb();
  const users = [...db.users].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).map(u => {
    const ownPhotos = db.photos.filter(p => p.userId === u.id);
    return {
      ...accountOf(u), name: u.profile?.name || u.username, handle: u.profile?.handle || '', avatarColor: u.profile?.avatarColor || '#65f4ff', avatarUrl: u.profile?.avatarUrl || null,
      bio: u.profile?.bio || '', home: u.profile?.home || '',
      disabled: !!u.disabled,
      photos: ownPhotos.length,
      people: db.people.filter(p => p.userId === u.id).length,
      lastPhotoAt: ownPhotos.length ? ownPhotos.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0].createdAt : null,
      lastLoginAt: u.lastLoginAt || null,
      invitesCreated: db.invites.filter(i => i.createdBy === u.id).length,
    };
  });
  res.json({ users });
});

app.patch('/api/admin/users/:id', async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: '不能修改自己的账号状态' });
  try {
    const result = await mutate(db => {
      const user = db.users.find(u => u.id === req.params.id);
      if (!user) return null;
      const actor = db.users.find(u => u.id === req.user.id);
      if (user.role === 'owner') { const e = new Error('不能修改主人账号'); e.status = 403; throw e; }
      if (actor.role === 'admin' && user.role !== 'member') { const e = new Error('管理员只能管理普通成员'); e.status = 403; throw e; }
      if (typeof req.body?.role === 'string') {
        const nextRole = req.body.role;
        if (!['admin', 'member'].includes(nextRole)) { const e = new Error('角色无效'); e.status = 400; throw e; }
        if (actor.role === 'admin' && !(user.role === 'member' && nextRole === 'admin')) {
          const e = new Error('管理员只能把普通成员设为管理员'); e.status = 403; throw e;
        }
        if (user.role !== nextRole) {
          user.role = nextRole;
          if (nextRole === 'member') user.sessionVersion = (user.sessionVersion || 0) + 1;
          user.updatedAt = new Date().toISOString();
        }
      }
      if (typeof req.body?.disabled === 'boolean') {
        user.disabled = req.body.disabled;
        user.sessionVersion = (user.sessionVersion || 0) + 1;
        user.updatedAt = new Date().toISOString();
      }
      return accountOf(user);
    });
    if (!result) return res.status(404).json({ error: '用户不存在' });
    res.json({ user: result });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || '操作失败' });
  }
});

app.post('/api/admin/users/:id/reset-password', async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: '请通过个人设置修改自己的密码' });
  try {
    const temp = generatePassword(12);
    const pwd = hashPassword(temp);
    const result = await mutate(db => {
      const user = db.users.find(u => u.id === req.params.id);
      if (!user) return null;
      if (user.role === 'owner') { const e = new Error('不能重置主人账号'); e.status = 403; throw e; }
      if (req.user.role === 'admin' && user.role !== 'member') { const e = new Error('管理员只能重置普通成员的密码'); e.status = 403; throw e; }
      user.passwordHash = pwd.hash;
      user.passwordSalt = pwd.salt;
      user.sessionVersion = (user.sessionVersion || 0) + 1;
      user.updatedAt = new Date().toISOString();
      return accountOf(user);
    });
    if (!result) return res.status(404).json({ error: '用户不存在' });
    res.json({ user: result, temporaryPassword: temp });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || '操作失败' });
  }
});

app.delete('/api/admin/users/:id', async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: '不能删除自己' });
  try {
    const removed = await mutate(db => {
      const idx = db.users.findIndex(u => u.id === req.params.id);
      if (idx < 0) return null;
      const target = db.users[idx];
      if (target.role === 'owner') return { owner: true };
      if (req.user.role === 'admin' && target.role !== 'member') return { forbidden: true };
      const [user] = db.users.splice(idx, 1);
      const photos = db.photos.filter(p => p.userId === user.id);
      db.photos = db.photos.filter(p => p.userId !== user.id);
      db.people = db.people.filter(p => p.userId !== user.id);
      db.invites = db.invites.filter(i => i.createdBy !== user.id);
      db.tracks = db.tracks.filter(t => t.userId !== user.id);
      return { user: accountOf(user), photos, avatarUrl: user.profile?.avatarUrl || null };
    });
    if (!removed) return res.status(404).json({ error: '用户不存在' });
    if (removed.owner) return res.status(400).json({ error: '不能删除主人账号' });
    if (removed.forbidden) return res.status(403).json({ error: '管理员只能删除普通成员' });
    for (const photo of removed.photos) await removeMedia(photo);
    await removeAvatarFile(removed.avatarUrl);
    res.json({ ok: true, removedPhotos: removed.photos.length });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || '操作失败' });
  }
});

app.get('/api/admin/invites', async (req, res) => {
  const db = await loadDb();
  res.json({ invites: [...db.invites].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(i => ({
    ...inviteView(i, db),
    creator: db.users.find(u => u.id === i.createdBy)?.username || 'unknown',
    creatorName: db.users.find(u => u.id === i.createdBy)?.profile?.name || '',
  })) });
});

app.delete('/api/admin/invites/:id', async (req, res) => {
  const result = await mutate(db => {
    const invite = db.invites.find(i => i.id === req.params.id);
    if (!invite) return null;
    if ((invite.uses || 0) >= (invite.maxUses || 1)) return { used: true };
    invite.revokedAt = new Date().toISOString();
    return { used: false };
  });
  if (!result) return res.status(404).json({ error: '邀请码不存在' });
  if (result.used) return res.status(400).json({ error: '已使用的邀请码不能撤销' });
  res.json({ ok: true });
});

async function removeAvatarFile(url) {
  if (!url || !url.startsWith('/media/avatars/')) return;
  const name = path.basename(url);
  if (!name || name === '.' || name === '..') return;
  try { await fs.unlink(path.join(AVATAR_DIR, name)); } catch {}
}

/* ---------- avatar ---------- */
app.post('/api/profile/avatar', uploadAvatar.single('avatar'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: '请选择头像图片' });
    let image;
    try { image = sharp(req.file.buffer, { failOn: 'none' }).rotate(); } catch {
      return res.status(422).json({ error: '头像图片无法读取' });
    }
    const meta = await image.metadata();
    if (!meta.width || !meta.height) return res.status(422).json({ error: '头像图片无法读取' });
    const name = `${req.user.id}-${crypto.randomBytes(7).toString('hex')}.webp`;
    const buf = await image.resize(640, 640, { fit: 'cover', position: 'centre' }).webp({ quality: 88, effort: 4 }).toBuffer();
    await fs.writeFile(path.join(AVATAR_DIR, name), buf);
    const oldUrl = req.user.profile?.avatarUrl;
    const avatarUrl = `/media/avatars/${name}`;
    await mutate(db => {
      const user = db.users.find(u => u.id === req.user.id);
      user.profile.avatarUrl = avatarUrl;
      user.profile.updatedAt = new Date().toISOString();
      user.updatedAt = user.profile.updatedAt;
    });
    await removeAvatarFile(oldUrl);
    res.json({ ok: true, avatarUrl });
  } catch (e) { next(e); }
});

app.delete('/api/profile/avatar', async (req, res) => {
  const oldUrl = req.user.profile?.avatarUrl || null;
  await mutate(db => {
    const user = db.users.find(u => u.id === req.user.id);
    delete user.profile.avatarUrl;
    user.profile.updatedAt = new Date().toISOString();
    user.updatedAt = user.profile.updatedAt;
  });
  await removeAvatarFile(oldUrl);
  res.json({ ok: true, avatarUrl: null });
});

function canViewPhoto(db, user, photo) {
  if (photo.userId === user.id) return true;
  if (user.role === 'owner') return true;
  if (user.role === 'admin') {
    const owner = db.users.find(u => u.id === photo.userId);
    return owner?.role === 'member';
  }
  return false;
}

/* ---------- media (auth) ---------- */
const MEDIA_DIRS = { uploads: UPLOAD_DIR, thumbs: THUMB_DIR, originals: ORIGINAL_DIR };
app.get('/media/avatars/:name', requireAuth, async (req, res) => {
  const fileName = path.basename(req.params.name);
  const db = await loadDb();
  const avatarUrl = `/media/avatars/${fileName}`;
  const owner = db.users.find(u => u.profile?.avatarUrl === avatarUrl);
  if (!owner || !canViewPhoto(db, req.user, { userId: owner.id })) return res.status(404).json({ error: '媒体文件不存在' });
  res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
  res.sendFile(path.join(AVATAR_DIR, fileName), err => { if (err) res.status(404).end(); });
});
app.get('/media/:kind/:name', requireAuth, async (req, res) => {
  const dir = MEDIA_DIRS[req.params.kind];
  if (!dir) return res.status(404).json({ error: '媒体文件不存在' });
  const fileName = path.basename(req.params.name);
  const url = `/media/${req.params.kind}/${fileName}`;
  const db = await loadDb();
  const owned = db.photos.some(p => canViewPhoto(db, req.user, p) && (p.image === url || p.thumb === url || p.original === url));
  if (!owned) return res.status(404).json({ error: '媒体文件不存在' });
  res.setHeader('Cache-Control', 'private, max-age=604800');
  res.sendFile(path.join(dir, fileName), err => { if (err) res.status(404).end(); });
});

/* ---------- static SPA ---------- */
app.use(express.static(DIST, {
  maxAge: '1y', immutable: true,
  setHeaders(res, filePath) {
    const base = path.basename(filePath);
    if (base === 'index.html' || base === 'sw.js' || base === 'manifest.webmanifest') {
      res.setHeader('Cache-Control', 'no-cache');
    }
    if (base === 'sw.js') res.setHeader('Service-Worker-Allowed', '/');
    if (base === 'manifest.webmanifest') res.setHeader('Content-Type', 'application/manifest+json');
  },
}));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/media/')) return res.status(404).json({ error: '资源不存在' });
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(DIST, 'index.html'), err => { if (err) next(); });
});
app.use(async (err, req, res, next) => {
  console.error('[atlas]', err.message);
  await cleanupUploadedFiles(req);
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: '单张照片不能超过 50MB' });
  if (err.code === 'LIMIT_FILE_COUNT') return res.status(413).json({ error: '一次最多上传 30 张照片' });
  res.status(err.status || 500).json({ error: err.message || '服务器处理失败' });
});

const bootDb = await loadDb();
setAmapKey(bootDb.settings?.amapKey || process.env.AMAP_KEY || '');
await loadGeo();
const server = app.listen(PORT, HOST, () => {
  console.log(`\n  ◆ LUMEN ATLAS online\n  → http://${HOST}:${PORT}\n  → data: ${DATA_DIR}\n`);
});
server.requestTimeout = 10 * 60 * 1000;
server.headersTimeout = 10 * 60 * 1000;
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => { server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 4000).unref(); });
}
