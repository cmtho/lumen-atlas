import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { hashPassword, generatePassword } from './passwords.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
export const DATA_DIR = process.env.ATLAS_DATA_DIR ? path.resolve(process.env.ATLAS_DATA_DIR) : path.join(ROOT, 'data');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
export const THUMB_DIR = path.join(DATA_DIR, 'thumbs');
export const ORIGINAL_DIR = path.join(DATA_DIR, 'originals');
export const AVATAR_DIR = path.join(DATA_DIR, 'avatars');
export const DB_FILE = path.join(DATA_DIR, 'db.json');
const OWNER_LOGIN_FILE = path.join(DATA_DIR, 'owner-login.txt');

const now = new Date().toISOString();

const demoPeople = [
  { id: 'p-me', name: '我', color: '#65f4ff', note: '坐标记录员', createdAt: now },
  { id: 'p-lin', name: '林夏', color: '#ffbd73', note: '同行的第七年', createdAt: now },
  { id: 'p-mori', name: 'Mori', color: '#b79cff', note: '在京都认识的旅人', createdAt: now },
];

function demoPhoto(i, data) {
  return {
    id: `demo-${String(i).padStart(2, '0')}`,
    demo: true,
    title: data.title,
    image: `/demo/${String(i).padStart(2, '0')}.webp`,
    thumb: `/demo/thumbs/${String(i).padStart(2, '0')}.webp`,
    original: null,
    capturedAt: data.date,
    dateSource: 'exif',
    country: data.country,
    countryCode: data.countryCode,
    province: data.province || '',
    city: data.city || '',
    district: data.district || '',
    locationName: data.locationName,
    lat: data.lat,
    lng: data.lng,
    personIds: data.people,
    tags: data.tags,
    notes: data.notes,
    camera: data.camera,
    lens: data.lens,
    aperture: data.aperture,
    shutter: data.shutter,
    iso: data.iso,
    focalLength: data.focalLength,
    dimensions: '1600 × 1200',
    fileSize: null,
    createdAt: now,
    updatedAt: now,
  };
}

const demoPhotos = [
  { title: '极光落在海面上', date: '2025-02-14T22:18:00.000Z', country: '冰岛', countryCode: 'is', province: '', city: '雷克雅未克', district: '', locationName: 'Grótta 灯塔', lat: 64.1466, lng: -21.9426, people: ['p-me', 'p-lin'], tags: ['极光', '海岸', '冬夜'], notes: '风大到站不稳，但绿色的光只出现了九十秒。', camera: 'Sony α7 IV', lens: 'FE 16-35mm F2.8 GM', aperture: 'f/2.8', shutter: '8s', iso: 800, focalLength: '16 mm' },
  { title: '南禅寺的最后一束光', date: '2024-11-23T16:42:00.000Z', country: '日本', countryCode: 'jp', province: '京都府', city: '京都市', district: '左京区', locationName: '南禅寺 · 水路阁', lat: 35.0116, lng: 135.7681, people: ['p-me', 'p-mori'], tags: ['寺院', '红叶', '京都'], notes: '赶在闭门前十分钟进去，光从砖拱里穿过来。', camera: 'Fujifilm X100VI', lens: '23mm F2', aperture: 'f/2.8', shutter: '1/250', iso: 400, focalLength: '23 mm' },
  { title: '凌晨四点的城市脉冲', date: '2025-01-08T20:05:00.000Z', country: '中国', countryCode: 'cn', province: '北京市', city: '北京市', district: '东城区', locationName: '东四 · 胡同屋顶', lat: 39.9175, lng: 116.4188, people: ['p-me'], tags: ['城市', '夜色', '北京'], notes: '蓝调时刻的屋顶，远处是还没熄灯的写字楼。', camera: 'Sony α7C II', lens: 'FE 35mm F1.8', aperture: 'f/1.8', shutter: '1/60', iso: 1600, focalLength: '35 mm' },
  { title: '雨后的竹林小径', date: '2024-08-17T09:12:00.000Z', country: '中国', countryCode: 'cn', province: '四川省', city: '成都市', district: '锦江区', locationName: '望江楼公园', lat: 30.657, lng: 104.083, people: ['p-me', 'p-lin'], tags: ['竹林', '雨天', '成都'], notes: '雨停之后的空气像被洗过。', camera: 'iPhone 15 Pro', lens: 'Main Camera 24mm', aperture: 'f/1.78', shutter: '1/120', iso: 80, focalLength: '24 mm' },
  { title: '玉龙雪山的第一场雪', date: '2024-06-02T07:36:00.000Z', country: '中国', countryCode: 'cn', province: '云南省', city: '丽江市', district: '古城区', locationName: '黑龙潭 · 得月楼', lat: 26.872, lng: 100.234, people: ['p-me'], tags: ['雪山', '清晨', '丽江'], notes: '早上六点出门，潭水把整座山倒过来。', camera: 'Nikon Z6 III', lens: 'Z 24-120mm f/4', aperture: 'f/8', shutter: '1/320', iso: 100, focalLength: '35 mm' },
  { title: '八廓街的转经人', date: '2024-09-11T15:20:00.000Z', country: '中国', countryCode: 'cn', province: '西藏自治区', city: '拉萨市', district: '城关区', locationName: '八廓街', lat: 29.65, lng: 91.13, people: ['p-me', 'p-mori'], tags: ['街巷', '人文', '拉萨'], notes: '没有拍下正脸，只留下转经筒转动的声音。', camera: 'Leica Q3', lens: 'Summilux 28mm f/1.7', aperture: 'f/5.6', shutter: '1/500', iso: 200, focalLength: '28 mm' },
  { title: '北纬七十度的蓝调', date: '2025-03-04T17:48:00.000Z', country: '挪威', countryCode: 'no', province: '特罗姆斯郡', city: '特罗姆瑟', district: '', locationName: 'Fjellheisen 缆车站', lat: 69.6492, lng: 18.9553, people: ['p-lin'], tags: ['极夜', '雪山', '蓝调'], notes: '缆车停运，最后是走上去的。', camera: 'Sony α7 IV', lens: 'FE 24-70mm F2.8 GM II', aperture: 'f/4', shutter: '1/125', iso: 640, focalLength: '50 mm' },
  { title: '外滩的雨夜折射', date: '2025-04-19T21:14:00.000Z', country: '中国', countryCode: 'cn', province: '上海市', city: '上海市', district: '黄浦区', locationName: '圆明园路', lat: 31.231, lng: 121.485, people: ['p-me', 'p-lin', 'p-mori'], tags: ['霓虹', '雨夜', '上海'], notes: '灯牌全落在积水里，像第二个城市。', camera: 'Fujifilm X-T5', lens: 'XF 23mm F1.4 R LM WR', aperture: 'f/1.4', shutter: '1/80', iso: 1250, focalLength: '23 mm' },
  { title: '深圳湾的晚风', date: '2025-05-02T18:56:00.000Z', country: '中国', countryCode: 'cn', province: '广东省', city: '深圳市', district: '南山区', locationName: '深圳湾公园', lat: 22.533, lng: 113.93, people: ['p-me'], tags: ['海岸', '日落', '深圳'], notes: '骑车的人从身边经过，天边变成青色。', camera: 'DJI Mini 4 Pro', lens: '24mm 等效', aperture: 'f/2.8', shutter: '1/200', iso: 100, focalLength: '24 mm' },
].map((p, i) => demoPhoto(i + 1, p));

export const DEFAULT_SETTINGS = {
  siteName: 'LUMEN ATLAS',
  tagline: '流光坐标 · PERSONAL ORBIT',
  description: '把每一次抵达，钉在地球上。',
  amapKey: '',
};

const DEFAULT_PROFILE = {
  name: '新旅人',
  handle: 'VOYAGER',
  bio: '在地球的褶皱里，收集光与坐标。',
  home: '',
  avatarColor: '#65f4ff',
  createdAt: now,
  updatedAt: now,
};

export const seedDatabase = () => ({
  version: 2,
  users: [],
  people: [],
  photos: [],
  invites: [],
  settings: { ...DEFAULT_SETTINGS },
});

export async function ensureDataDirs() {
  await Promise.all([UPLOAD_DIR, THUMB_DIR, ORIGINAL_DIR, AVATAR_DIR].map(d => fs.mkdir(d, { recursive: true })));
}

async function writeOwnerCredentials(username, password) {
  try {
    await fs.writeFile(OWNER_LOGIN_FILE, `LUMEN ATLAS OWNER LOGIN\nusername: ${username}\npassword: ${password}\nurl: https://lumen.chemcraze.asia\ncreated: ${new Date().toISOString()}\n`, { mode: 0o600 });
  } catch {}
}

function ensureUsername(value) {
  const cleaned = String(value || 'owner').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24);
  return cleaned.length >= 3 ? cleaned : `owner${cleaned}`;
}

async function migrateV1(raw) {
  let username = ensureUsername(process.env.ATLAS_OWNER_USERNAME || raw.profile?.handle || 'owner');
  const password = process.env.ATLAS_OWNER_PASSWORD || generatePassword(18);
  const { hash, salt } = hashPassword(password);
  const ownerId = 'u-owner';
  const profile = { ...DEFAULT_PROFILE, ...(raw.profile || {}), createdAt: raw.profile?.createdAt || now, updatedAt: now };
  const owner = {
    id: ownerId,
    username,
    passwordHash: hash,
    passwordSalt: salt,
    role: 'owner',
    sessionVersion: 0,
    createdAt: raw.profile?.createdAt || now,
    updatedAt: now,
    profile,
  };
  const people = (raw.people || []).map(p => ({ ...p, userId: ownerId }));
  const photos = (raw.photos || []).map(p => ({ ...p, userId: ownerId }));
  const migrated = { version: 2, users: [owner], people, photos, invites: [], settings: { ...DEFAULT_SETTINGS } };
  await writeOwnerCredentials(username, password);
  return migrated;
}

let cache = null;
let writeQueue = Promise.resolve();

export async function loadDb() {
  if (cache) return cache;
  await ensureDataDirs();
  let raw;
  let exists = true;
  let migrated = false;
  try {
    raw = JSON.parse(await fs.readFile(DB_FILE, 'utf8'));
  } catch {
    raw = seedDatabase();
    exists = false;
  }
  if (!raw.users) {
    raw = await migrateV1(raw);
    migrated = true;
  }
  raw.version = 2;
  if (!Array.isArray(raw.users)) raw.users = [];
  if (!Array.isArray(raw.people)) raw.people = [];
  if (!Array.isArray(raw.photos)) raw.photos = [];
  if (!Array.isArray(raw.invites)) raw.invites = [];
  if (!raw.settings || typeof raw.settings !== 'object') {
    raw.settings = { ...DEFAULT_SETTINGS };
    migrated = true;
  } else {
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      if (raw.settings[key] == null) { raw.settings[key] = value; migrated = true; }
    }
  }
  cache = raw;
  if (!exists || migrated) await persist(cache);
  return cache;
}

async function persist(data) {
  const tmp = `${DB_FILE}.${process.pid}.${crypto.randomBytes(3).toString('hex')}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2));
  await fs.rename(tmp, DB_FILE);
}

export function mutate(mutator) {
  writeQueue = writeQueue.catch(() => {}).then(async () => {
    const db = await loadDb();
    const result = await mutator(db);
    await persist(db);
    return result;
  });
  return writeQueue;
}

export function nextId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`;
}

export function getDemoPhotosForUser(user, people = []) {
  const ids = new Set(people.map(p => p.id));
  return demoPhotos.map(p => ({
    ...p,
    id: `demo-${user.id}-${p.id}`,
    userId: user.id,
    personIds: (p.personIds || []).filter(id => ids.has(id)),
    createdAt: now,
    updatedAt: now,
  }));
}

export { ROOT, demoPeople, demoPhotos, DEFAULT_PROFILE };
