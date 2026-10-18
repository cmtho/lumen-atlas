#!/usr/bin/env node
/**
 * Create a self-contained demo database for a source/demo package.
 * Usage: node scripts/create-demo-db.mjs /path/to/package/data
 *
 * This never writes to the repository's own data/ unless you explicitly pass it.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { demoPeople, demoPhotos, DEFAULT_SETTINGS } from '../server/db.js';
import { hashPassword } from '../server/passwords.js';

const outDir = process.argv[2];
if (!outDir) {
  console.error('Usage: node scripts/create-demo-db.mjs <output-data-dir>');
  process.exit(1);
}

const now = new Date().toISOString();
const userId = 'u-demo';
const { hash, salt } = hashPassword('demo12345');
const profile = {
  name: '星野',
  handle: 'DEMO',
  bio: '在地球的褶皱里，收集光与坐标。',
  home: '杭州 · 中国',
  avatarColor: '#6ff5ff',
  createdAt: now,
  updatedAt: now,
};
const user = {
  id: userId,
  username: 'demo',
  passwordHash: hash,
  passwordSalt: salt,
  role: 'owner',
  sessionVersion: 0,
  createdAt: now,
  updatedAt: now,
  profile,
};
const people = demoPeople.map(p => ({ ...p, userId }));
const photos = demoPhotos.map(p => ({ ...p, userId, createdAt: now, updatedAt: now }));
const db = {
  version: 2,
  users: [user],
  people,
  photos,
  invites: [],
  settings: { ...DEFAULT_SETTINGS },
};

await fs.mkdir(outDir, { recursive: true });
await fs.writeFile(path.join(outDir, 'db.json'), JSON.stringify(db, null, 2));
await fs.writeFile(path.join(outDir, 'owner-login.txt'), `LUMEN ATLAS DEMO LOGIN\nusername: demo\npassword: demo12345\ncreated: ${now}\n`, { mode: 0o600 });
console.log(`Demo database written to ${outDir}`);
console.log('demo / demo12345 · 9 demo photos · 3 demo people');
