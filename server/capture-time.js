const EXIF_STAMP = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/;
const OFFSET = /^([+-])(\d{2}):?(\d{2})$/;
const pad = (n) => String(n).padStart(2, '0');

function validParts(parts) {
  if (!parts) return null;
  const { year, month, day, hour, minute, second } = parts;
  const d = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day ||
      d.getUTCHours() !== hour || d.getUTCMinutes() !== minute || d.getUTCSeconds() !== second) return null;
  return parts;
}

export function parseWallTime(value) {
  if (typeof value !== 'string') return null;
  const m = value.trim().match(EXIF_STAMP);
  if (!m) return null;
  return validParts({
    year: Number(m[1]), month: Number(m[2]), day: Number(m[3]),
    hour: Number(m[4]), minute: Number(m[5]), second: Number(m[6]),
  });
}

export function wallString(parts) {
  if (!parts) return null;
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`;
}

export function localWallFromDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function normalizeOffset(value) {
  if (value == null) return null;
  const m = String(value).trim().match(OFFSET);
  if (!m) return null;
  const hour = Number(m[2]), minute = Number(m[3]);
  if (hour > 23 || minute > 59) return null;
  return `${m[1]}${pad(hour)}:${pad(minute)}`;
}

export function resolveCaptureTime(exif = {}, fallbackAt = null) {
  const raw = exif.DateTimeOriginal ?? exif.dateTimeOriginal ??
    exif.CreateDate ?? exif.createDate ?? exif.ModifyDate ?? exif.modifyDate;
  const parts = parseWallTime(raw);
  const local = wallString(parts);
  const offset = normalizeOffset(exif.OffsetTimeOriginal ?? exif.offsetTimeOriginal ??
    exif.OffsetTime ?? exif.offsetTime ?? exif.OffsetTimeDigitized ?? exif.offsetTimeDigitized ?? null);

  if (local) {
    if (offset) {
      const instant = new Date(`${local}${offset}`);
      return {
        capturedAt: Number.isNaN(instant.getTime()) ? null : instant.toISOString(),
        capturedLocal: local,
        tzOffset: offset,
        dateSource: 'exif',
      };
    }
    return { capturedAt: null, capturedLocal: local, tzOffset: null, dateSource: 'exif-local' };
  }

  if (fallbackAt != null) {
    const d = new Date(fallbackAt);
    if (!Number.isNaN(d.getTime())) {
      return {
        capturedAt: d.toISOString(),
        capturedLocal: localWallFromDate(d),
        tzOffset: null,
        dateSource: 'file',
      };
    }
  }

  return { capturedAt: null, capturedLocal: null, tzOffset: null, dateSource: 'file' };
}
