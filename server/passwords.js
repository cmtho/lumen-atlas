import crypto from 'node:crypto';

const KEY_LEN = 64;
export const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
export const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, KEY_LEN).toString('hex');
  return { hash, salt };
}

export function verifyPassword(password, salt, hash) {
  try {
    const test = crypto.scryptSync(String(password), String(salt), KEY_LEN);
    const expected = Buffer.from(String(hash), 'hex');
    return test.length === expected.length && crypto.timingSafeEqual(test, expected);
  } catch {
    return false;
  }
}

export function generatePassword(length = 16) {
  return Array.from({ length }, () => PASSWORD_ALPHABET[crypto.randomInt(0, PASSWORD_ALPHABET.length)]).join('');
}

export function generateInviteCode() {
  const raw = Array.from({ length: 10 }, () => INVITE_ALPHABET[crypto.randomInt(0, INVITE_ALPHABET.length)]).join('');
  return `LUMEN-${raw.slice(0, 5)}-${raw.slice(5)}`;
}
