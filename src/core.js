/**
 * Base45 core encode/decode logic per RFC 9285.
 *
 * The alphabet is ordered exactly as in the RFC: digits first, then letters,
 * then space, then the punctuation chars. This ordering matters because the
 * numeric value of each character is its index in this string.
 */
export const ALPHABET =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

const BASE = 45;
const BASE_SQUARED = 45 * 45; // 2025
const BASE_CUBED = 45 * 45 * 45; // 91125

// Precompute reverse lookup for O(1) character-to-value mapping.
const DECODE_TABLE = (() => {
  const t = new Int8Array(128).fill(-1);
  for (let i = 0; i < ALPHABET.length; i++) {
    t[ALPHABET.charCodeAt(i)] = i;
  }
  return t;
})();

/**
 * Encode a Uint8Array to a Base45 string.
 *
 * RFC 9285 processes input in chunks of two bytes. Each pair is treated as a
 * big-endian 16-bit integer and emitted as three Base45 digits (least
 * significant first). A trailing single byte is emitted as two Base45 digits.
 * We throw on non-Uint8Array input rather than coercing, because silent
 * coercion of node Buffers or number arrays hides bugs at the call site.
 */
export function encode(bytes) {
  if (!(bytes instanceof Uint8Array)) {
    throw new TypeError('encode expects a Uint8Array');
  }

  let out = '';
  const len = bytes.length;

  for (let i = 0; i < len; i += 2) {
    if (i + 1 < len) {
      const val = bytes[i] * 256 + bytes[i + 1];
      const d0 = val % BASE;
      const d1 = Math.floor(val / BASE) % BASE;
      const d2 = Math.floor(val / BASE_SQUARED) % BASE;
      out += ALPHABET[d0] + ALPHABET[d1] + ALPHABET[d2];
    } else {
      const val = bytes[i];
      const d0 = val % BASE;
      const d1 = Math.floor(val / BASE) % BASE;
      out += ALPHABET[d0] + ALPHABET[d1];
    }
  }

  return out;
}

/**
 * Decode a Base45 string to a Uint8Array.
 *
 * Input length must be a multiple of 3 (full two-byte chunks) plus an optional
 * trailing multiple of 2 (single-byte chunks). Any other length is invalid.
 * We reject characters outside the alphabet and values that would overflow a
 * byte (e.g. a two-digit group decoding to 256+). We do NOT lowercase input;
 * RFC 9285 defines an exact alphabet and silent canonicalisation would mask
 * corrupted data.
 */
export function decode(str) {
  if (typeof str !== 'string') {
    throw new TypeError('decode expects a string');
  }

  const len = str.length;
  if (len === 0) {
    return new Uint8Array(0);
  }

  // Validate length: remainder when divided by 3 must be 0 or 2.
  const rem = len % 3;
  if (rem === 1) {
    throw new Error('Invalid Base45: length % 3 === 1');
  }

  // Count trailing two-digit groups: if len % 3 === 2, there is exactly one.
  const hasTrailingPair = rem === 2;
  const tripleCount = hasTrailingPair ? Math.floor(len / 3) : len / 3;

  const outLen = tripleCount * 2 + (hasTrailingPair ? 1 : 0);
  const out = new Uint8Array(outLen);

  let outIdx = 0;
  let strIdx = 0;

  for (let t = 0; t < tripleCount; t++) {
    const c0 = charValue(str, strIdx);
    const c1 = charValue(str, strIdx + 1);
    const c2 = charValue(str, strIdx + 2);
    strIdx += 3;

    const val = c0 + BASE * c1 + BASE_SQUARED * c2;
    if (val > 0xffff) {
      throw new Error('Invalid Base45: three-digit group exceeds 0xFFFF');
    }

    out[outIdx++] = (val >> 8) & 0xff;
    out[outIdx++] = val & 0xff;
  }

  if (hasTrailingPair) {
    const c0 = charValue(str, strIdx);
    const c1 = charValue(str, strIdx + 1);

    const val = c0 + BASE * c1;
    if (val > 0xff) {
      throw new Error('Invalid Base45: two-digit group exceeds 0xFF');
    }

    out[outIdx++] = val & 0xff;
  }

  return out;
}

function charValue(str, idx) {
  const code = str.charCodeAt(idx);
  if (code >= 128) {
    throw new Error(`Invalid Base45 character at position ${idx}`);
  }
  const v = DECODE_TABLE[code];
  if (v === -1) {
    throw new Error(`Invalid Base45 character at position ${idx}`);
  }
  return v;
}
