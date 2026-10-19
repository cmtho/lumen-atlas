#!/usr/bin/env node
/**
 * Backfill capturedLocal / tzOffset and repair capturedAt from original EXIF.
 *
 * Default: dry-run, no write.
 * Apply:   node scripts/backfill-capture-time.mjs --apply
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import exifr from 'exifr';
import { DB_FILE, ORIGINAL_DIR, loadDb, mutate } from '../server/db.js';
import { resolveCaptureTime } from '../server/capture-time.js';

const apply = process.argv.includes('--apply');

async function readRawExif(file) {
  const buffer = await fs.readFile(file);
  return exifr.parse(buffer, {
    exif: true,
    tiff: true,
    ifd0: true,
    translateValues: false,
    reviveValues: false,
  });
}

function originalPath(photo) {
  const name = path.basename(photo.original || '');
  return name ? path.join(ORIGINAL_DIR, name) : null;
}

const rawDb = JSON.parse(await fs.readFile(DB_FILE, 'utf8'));
const photos = Array.isArray(rawDb.photos) ? rawDb.photos : [];
const changes = [];
const missingOriginal = [];
const manualSkipped = [];

for (const photo of photos) {
  if (photo.demo) continue;
  if (photo.dateSource === 'manual') {
    manualSkipped.push(photo);
    continue;
  }

  const file = originalPath(photo);
  if (!file) {
    missingOriginal.push(photo);
    continue;
  }
  let stat;
  let exif;
  try {
    stat = await fs.stat(file);
    exif = await readRawExif(file);
  } catch {
    missingOriginal.push(photo);
    continue;
  }

  const fallbackAt = stat.mtimeMs;
  const next = resolveCaptureTime(exif || {}, fallbackAt);
  const prev = {
    capturedAt: photo.capturedAt ?? null,
    capturedLocal: photo.capturedLocal ?? null,
    tzOffset: photo.tzOffset ?? null,
    dateSource: photo.dateSource ?? null,
  };
  const value = {
    capturedAt: next.capturedAt,
    capturedLocal: next.capturedLocal,
    tzOffset: next.tzOffset,
    dateSource: next.dateSource,
  };
  if (JSON.stringify(prev) !== JSON.stringify(value)) {
    changes.push({ photo, file: file || null, prev, value });
  }
}

console.log(`\nLUMEN ATLAS capture-time backfill (${apply ? 'APPLY' : 'DRY-RUN'})\n`);
console.log(`DB: ${DB_FILE}`);
console.log(`photos: ${photos.length}`);
console.log(`would change: ${changes.length}`);
console.log(`manual skipped: ${manualSkipped.length}`);
console.log(`missing original: ${missingOriginal.length}`);

for (const item of changes.slice(0, 5)) {
  console.log(`\n- ${item.photo.id} ${item.photo.title || ''}`);
  console.log(`  original: ${item.file || '(missing)'}`);
  console.log(`  before:   ${JSON.stringify(item.prev)}`);
  console.log(`  after:    ${JSON.stringify(item.value)}`);
}

if (!apply) {
  console.log('\nDry-run only. Re-run with --apply to write.\n');
  process.exit(0);
}

if (!changes.length) {
  console.log('\nNothing to write.\n');
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backup = `${DB_FILE}.bak-${stamp}`;
await fs.copyFile(DB_FILE, backup);
await fs.chmod(backup, 0o600);
console.log(`\nbackup: ${backup}`);

await mutate(db => {
  for (const item of changes) {
    const photo = db.photos.find(p => p.id === item.photo.id);
    if (!photo) continue;
    Object.assign(photo, item.value);
    photo.updatedAt = new Date().toISOString();
  }
});

console.log(`applied: ${changes.length} photo(s)\n`);
