# Base45 Encoder

Encodes and decodes Base45 as specified in RFC 9285. Zero dependencies, ESM only.

```js
import { encode, decode } from './src/index.js';

const bytes = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
const encoded = encode(bytes);        // "%69 VD92"
const decoded = decode(encoded);      // Uint8Array [0x48, 0x65, 0x6c, 0x6c, 0x6f]
```

## Why

Base45 is designed for QR codes: it packs more data per symbol than Base64 while using only characters that QR code readers handle reliably. The trade-off is a slightly more complex chunking scheme (two input bytes become three output characters, with a special case for trailing single bytes) and an alphabet that includes space, which complicates transport in formats that trim whitespace.

## Edge cases

- Input to `encode` must be a `Uint8Array`. Node `Buffer` is a subclass of `Uint8Array` and works directly, but plain arrays and strings are rejected.
- `decode` does not lowercase input. RFC 9285 defines an exact alphabet; lowercase letters are invalid and will throw.
- A two-character trailing group that decodes to a value above 255 is rejected, as is a three-character group above 65535. These can only arise from malformed input.
- Input length to `decode` must satisfy `len % 3 !== 1`; a lone trailing character is never valid.

## Exports

- `encode(bytes: Uint8Array): string`
- `decode(str: string): Uint8Array`
- `ALPHABET: string` — the 45-character alphabet in RFC order.
