import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { encode, decode, ALPHABET } from '../src/index.js';

describe('Base45 RFC 9285 vectors', () => {
  // These are the exact vectors from Section 4 of RFC 9285.
  it('encodes "AB" to "BB8"', () => {
    assert.equal(
      encode(new Uint8Array([0x41, 0x42])),
      'BB8'
    );
  });

  it('encodes "Hello!!" to "%69 VD92EX0"', () => {
    assert.equal(
      encode(new Uint8Array([
        0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x21, 0x21
      ])),
      '%69 VD92EX0'
    );
  });

  it('encodes "base-45" to "UJCLQE7W581"', () => {
    assert.equal(
      encode(new Uint8Array([
        0x62, 0x61, 0x73, 0x65, 0x2d, 0x34, 0x35
      ])),
      'UJCLQE7W581'
    );
  });

  it('decodes "BB8" to "AB"', () => {
    assert.deepEqual(
      decode('BB8'),
      new Uint8Array([0x41, 0x42])
    );
  });

  it('decodes "%69 VD92EX0" to "Hello!!"', () => {
    assert.deepEqual(
      decode('%69 VD92EX0'),
      new Uint8Array([
        0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x21, 0x21
      ])
    );
  });

  it('decodes "UJCLQE7W581" to "base-45"', () => {
    assert.deepEqual(
      decode('UJCLQE7W581'),
      new Uint8Array([
        0x62, 0x61, 0x73, 0x65, 0x2d, 0x34, 0x35
      ])
    );
  });
});

describe('round-trip', () => {
  for (const len of [0, 1, 2, 3, 4, 5, 10, 31, 100]) {
    it(`round-trips ${len} bytes`, () => {
      const input = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        input[i] = (i * 37 + 11) & 0xff;
      }
      assert.deepEqual(decode(encode(input)), input);
    });
  }

  it('round-trips all 256 byte values', () => {
    const input = new Uint8Array(256);
    for (let i = 0; i < 256; i++) input[i] = i;
    assert.deepEqual(decode(encode(input)), input);
  });
});

describe('edge cases', () => {
  it('encodes empty input to empty string', () => {
    assert.equal(encode(new Uint8Array(0)), '');
  });

  it('decodes empty string to empty Uint8Array', () => {
    assert.deepEqual(decode(''), new Uint8Array(0));
  });

  it('encodes a single byte as two characters', () => {
    // 0x00 -> digits 0,0 -> "00"
    assert.equal(encode(new Uint8Array([0])), '00');
    // 0xFF (255) -> 255 % 45 = 30, floor(255/45) = 5 -> ALPHABET[30]+'5' = 'U5'
    assert.equal(encode(new Uint8Array([0xff])), 'U5');
  });

  it('decodes a two-character group back to one byte', () => {
    assert.deepEqual(decode('00'), new Uint8Array([0]));
    assert.deepEqual(decode('U5'), new Uint8Array([0xff]));
  });
});

describe('error handling', () => {
  it('rejects non-Uint8Array input to encode', () => {
    assert.throws(() => encode([1, 2, 3]), TypeError);
    assert.throws(() => encode('hello'), TypeError);
    assert.throws(() => encode(null), TypeError);
  });

  it('rejects non-string input to decode', () => {
    assert.throws(() => decode(123), TypeError);
    assert.throws(() => decode(null), TypeError);
    assert.throws(() => decode(new Uint8Array([1])), TypeError);
  });

  it('rejects input whose length mod 3 is 1', () => {
    assert.throws(() => decode('A'), /length/);
    assert.throws(() => decode('AAAA'), /length/);
  });

  it('rejects characters outside the alphabet', () => {
    assert.throws(() => decode('AB!'), /Invalid Base45 character/);
    assert.throws(() => decode('ab'), /Invalid Base45 character/);
    assert.throws(() => decode('A~'), /Invalid Base45 character/);
  });

  it('rejects a two-digit group that exceeds 0xFF', () => {
    // ALPHABET[44] = '%', ALPHABET[5] = '5'
    // val = 44 + 45*5 = 269 > 255
    assert.throws(() => decode('%5'), /exceeds 0xFF/);
  });

  it('rejects a three-digit group that exceeds 0xFFFF', () => {
    // We need c0 + 45*c1 + 2025*c2 > 65535.
    // Max c2 = 44 -> 2025*44 = 89100. 65535 - 89100 < 0, so any c2=44 works.
    // c0=44('%'), c1=44('%'), c2=44('%') -> 44 + 1980 + 89100 = 91124 > 65535
    assert.throws(() => decode('%%%'), /exceeds 0xFFFF/);
  });
});

describe('alphabet', () => {
  it('has exactly 45 characters', () => {
    assert.equal(ALPHABET.length, 45);
  });

  it('contains space, $, and % at the end', () => {
    assert.equal(ALPHABET[36], ' ');
    assert.equal(ALPHABET[37], '$');
    assert.equal(ALPHABET[38], '%');
  });
});
