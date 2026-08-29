/* ============================================================================
   Tend - qr.js
   ----------------------------------------------------------------------------
   A small QR encoder, written out in full so the install code works with no
   network, no CDN and no third-party service - it has to keep working inside
   the single-file build and on a phone with no signal.

   Scope is deliberately narrow: byte mode, error correction level M, versions
   1 to 10. That covers any URL up to 216 characters, which is far more than a
   site address needs.

   Qr.matrix(text) -> { size, modules }   modules[row][col] is true for dark
   Qr.svg(text, opts) -> an <svg> string
   ============================================================================ */

const Qr = (function () {
  'use strict';

  /* ---- capacity tables, error correction level M ---- */
  /* [ total codewords, ec codewords per block, [ [blocks, data codewords], ... ] ] */
  const VERSIONS = {
    1:  [26,  10, [[1, 16]]],
    2:  [44,  16, [[1, 28]]],
    3:  [70,  26, [[1, 44]]],
    4:  [100, 18, [[2, 32]]],
    5:  [134, 24, [[2, 43]]],
    6:  [172, 16, [[4, 27]]],
    7:  [196, 18, [[4, 31]]],
    8:  [242, 22, [[2, 38], [2, 39]]],
    9:  [292, 22, [[3, 36], [2, 37]]],
    10: [346, 26, [[4, 43], [1, 44]]]
  };

  const ALIGNMENT = {
    1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
    6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50]
  };

  /* ---- GF(256) arithmetic, the field QR's Reed-Solomon runs in ---- */
  const EXP = new Uint8Array(512);
  const LOG = new Uint8Array(256);
  (function initGF() {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      EXP[i] = x;
      LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;      /* the QR primitive polynomial */
    }
    for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  })();

  function gfMul(a, b) {
    if (a === 0 || b === 0) return 0;
    return EXP[LOG[a] + LOG[b]];
  }

  /* The generator polynomial for n error correction codewords. */
  function rsGenerator(n) {
    let poly = [1];
    for (let i = 0; i < n; i++) {
      const next = new Array(poly.length + 1).fill(0);
      for (let j = 0; j < poly.length; j++) {
        next[j] ^= poly[j];                      /* x * poly            */
        next[j + 1] ^= gfMul(poly[j], EXP[i]);   /* alpha^i * poly      */
      }
      poly = next;
    }
    return poly;
  }

  function rsEncode(data, ecCount) {
    const gen = rsGenerator(ecCount);
    const rem = new Array(ecCount).fill(0);
    for (let i = 0; i < data.length; i++) {
      const factor = data[i] ^ rem[0];
      rem.shift();
      rem.push(0);
      if (factor !== 0) {
        for (let j = 0; j < ecCount; j++) rem[j] ^= gfMul(gen[j + 1], factor);
      }
    }
    return rem;
  }

  /* ---- BCH codes for the format and version information ---- */

  function bch(value, poly, bits) {
    let v = value << bits;
    const polyBits = poly.toString(2).length - 1;
    while (v.toString(2).length - 1 >= polyBits) {
      v ^= poly << (v.toString(2).length - 1 - polyBits);
    }
    return (value << bits) | v;
  }

  function formatBits(mask) {
    /* Level M is 00; five bits of level + mask, BCH(15,5), then the mask
       pattern the standard applies so an all-zero format is not all zeros. */
    const data = (0x00 << 3) | mask;
    return (bch(data, 0x537, 10)) ^ 0x5412;
  }

  function versionBits(version) {
    return bch(version, 0x1f25, 12);
  }

  /* Where each of the fifteen format bits goes, bit 0 first, for both copies.
     The awkward jumps around row and column 8 avoid the timing patterns. */
  function formatBitCells(size) {
    const first = [];
    for (let i = 0; i <= 5; i++) first.push([i, 8]);
    first.push([7, 8]);
    first.push([8, 8]);
    first.push([8, 7]);
    for (let i = 9; i < 15; i++) first.push([8, 14 - i]);

    const second = [];
    for (let i = 0; i < 8; i++) second.push([8, size - 1 - i]);
    for (let i = 8; i < 15; i++) second.push([size - 15 + i, 8]);

    return first.concat(second);
  }

  /* The same squares, plus the always-dark module, as a set to reserve. */
  function formatCells(size) {
    return formatBitCells(size).concat([[size - 8, 8]]);
  }

  /* ---- text to bytes (UTF-8) ---- */
  function utf8(text) {
    const out = [];
    for (const ch of String(text)) {
      const cp = ch.codePointAt(0);
      if (cp < 0x80) out.push(cp);
      else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 63));
      else if (cp < 0x10000) out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
      else out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    }
    return out;
  }

  function pickVersion(byteLen) {
    for (let v = 1; v <= 10; v++) {
      const [total, ecPerBlock, groups] = VERSIONS[v];
      const dataCodewords = groups.reduce((n, [blocks, count]) => n + blocks * count, 0);
      const countBits = v < 10 ? 8 : 16;
      const needed = Math.ceil((4 + countBits + byteLen * 8) / 8);
      if (needed <= dataCodewords) return v;
    }
    return null;
  }

  /* ---- the bit stream ---- */
  function buildCodewords(bytes, version) {
    const [, ecPerBlock, groups] = VERSIONS[version];
    const dataCodewords = groups.reduce((n, [blocks, count]) => n + blocks * count, 0);
    const countBits = version < 10 ? 8 : 16;

    const bits = [];
    const push = (value, len) => {
      for (let i = len - 1; i >= 0; i--) bits.push((value >> i) & 1);
    };

    push(0b0100, 4);                 /* byte mode */
    push(bytes.length, countBits);
    bytes.forEach(b => push(b, 8));

    /* Terminator, then round up to a whole codeword. */
    const capacity = dataCodewords * 8;
    for (let i = 0; i < 4 && bits.length < capacity; i++) bits.push(0);
    while (bits.length % 8 !== 0) bits.push(0);

    const words = [];
    for (let i = 0; i < bits.length; i += 8) {
      let b = 0;
      for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
      words.push(b);
    }
    const PAD = [0xec, 0x11];
    for (let i = 0; words.length < dataCodewords; i++) words.push(PAD[i % 2]);

    /* Split into blocks, add error correction, then interleave both. */
    const dataBlocks = [];
    const ecBlocks = [];
    let at = 0;
    groups.forEach(([blocks, count]) => {
      for (let i = 0; i < blocks; i++) {
        const block = words.slice(at, at + count);
        at += count;
        dataBlocks.push(block);
        ecBlocks.push(rsEncode(block, ecPerBlock));
      }
    });

    const out = [];
    const maxData = Math.max(...dataBlocks.map(b => b.length));
    for (let i = 0; i < maxData; i++) {
      dataBlocks.forEach(b => { if (i < b.length) out.push(b[i]); });
    }
    for (let i = 0; i < ecPerBlock; i++) {
      ecBlocks.forEach(b => out.push(b[i]));
    }
    return out;
  }

  /* ---- the module grid ---- */

  function buildMatrix(version, codewords) {
    const size = version * 4 + 17;
    const modules = [];
    const reserved = [];
    for (let r = 0; r < size; r++) {
      modules.push(new Array(size).fill(false));
      reserved.push(new Array(size).fill(false));
    }

    const set = (r, c, dark, isReserved) => {
      if (r < 0 || c < 0 || r >= size || c >= size) return;
      modules[r][c] = dark;
      reserved[r][c] = isReserved !== false;
    };

    /* Finder patterns and their separators. */
    const finder = (top, left) => {
      for (let r = -1; r <= 7; r++) {
        for (let c = -1; c <= 7; c++) {
          const rr = top + r, cc = left + c;
          if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue;
          const inRing = (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
                         (c >= 0 && c <= 6 && (r === 0 || r === 6));
          const inCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          set(rr, cc, inRing || inCore);
        }
      }
    };
    finder(0, 0);
    finder(0, size - 7);
    finder(size - 7, 0);

    /* Timing patterns. */
    for (let i = 8; i < size - 8; i++) {
      set(6, i, i % 2 === 0);
      set(i, 6, i % 2 === 0);
    }

    /* Alignment patterns, skipping the three finder corners. */
    const centers = ALIGNMENT[version];
    centers.forEach(r => centers.forEach(c => {
      const nearFinder = (r <= 8 && c <= 8) ||
                         (r <= 8 && c >= size - 9) ||
                         (r >= size - 9 && c <= 8);
      if (nearFinder) return;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const ring = Math.max(Math.abs(dr), Math.abs(dc));
          set(r + dr, c + dc, ring !== 1);
        }
      }
    }));

    /* The one module that is always dark. */
    set(size - 8, 8, true);

    /* Reserve the two format-information areas. The bits themselves are
       written after masking, so for now these squares are just claimed. */
    formatCells(size).forEach(([r, c]) => {
      if (!reserved[r][c]) set(r, c, false);
    });

    /* Version information, from version 7 up. */
    if (version >= 7) {
      const vb = versionBits(version);
      for (let i = 0; i < 18; i++) {
        const bit = ((vb >> i) & 1) === 1;
        const r = Math.floor(i / 3);
        const c = i % 3;
        set(r, size - 11 + c, bit);
        set(size - 11 + c, r, bit);
      }
    }

    /* Data, laid out in a zigzag from the bottom right. */
    let bitIndex = 0;
    const nextBit = () => {
      const byte = codewords[bitIndex >> 3];
      const bit = byte === undefined ? 0 : (byte >> (7 - (bitIndex & 7))) & 1;
      bitIndex++;
      return bit === 1;
    };

    let upward = true;
    for (let right = size - 1; right > 0; right -= 2) {
      if (right === 6) right = 5;            /* the vertical timing column */
      for (let step = 0; step < size; step++) {
        const r = upward ? size - 1 - step : step;
        for (const c of [right, right - 1]) {
          if (reserved[r][c]) continue;   /* reserved = a function module */
          modules[r][c] = nextBit();
        }
      }
      upward = !upward;
    }

    return { size, modules, reserved };
  }

  const MASKS = [
    (r, c) => (r + c) % 2 === 0,
    (r) => r % 2 === 0,
    (r, c) => c % 3 === 0,
    (r, c) => (r + c) % 3 === 0,
    (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
    (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
    (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
    (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0
  ];

  function applyMask(base, maskIndex) {
    const size = base.size;
    const modules = base.modules.map(row => row.slice());
    const fn = MASKS[maskIndex];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (base.reserved[r][c]) continue;
        if (fn(r, c)) modules[r][c] = !modules[r][c];
      }
    }
    /* Format information, written after masking. Both copies, in the order
       the standard lays them out. */
    const fb = formatBits(maskIndex);
    formatBitCells(size).forEach(([r, c], i) => {
      modules[r][c] = ((fb >> (i % 15)) & 1) === 1;
    });
    modules[size - 8][8] = true;
    return { size, modules };
  }

  /* The standard's four penalty rules; the lowest-scoring mask is used, which
     is what keeps a code readable in poor light and at an angle. */
  function penalty(grid) {
    const size = grid.size, m = grid.modules;
    let score = 0;

    const runScore = line => {
      let total = 0, run = 1;
      for (let i = 1; i < line.length; i++) {
        if (line[i] === line[i - 1]) run++;
        else { if (run >= 5) total += 3 + (run - 5); run = 1; }
      }
      if (run >= 5) total += 3 + (run - 5);
      return total;
    };
    for (let r = 0; r < size; r++) score += runScore(m[r]);
    for (let c = 0; c < size; c++) score += runScore(m.map(row => row[c]));

    for (let r = 0; r < size - 1; r++) {
      for (let c = 0; c < size - 1; c++) {
        const v = m[r][c];
        if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) score += 3;
      }
    }

    const PATTERN = [true, false, true, true, true, false, true, false, false, false, false];
    const hasAt = (line, i) => PATTERN.every((v, k) => line[i + k] === v);
    const reversed = PATTERN.slice().reverse();
    const hasRevAt = (line, i) => reversed.every((v, k) => line[i + k] === v);
    const scanLine = line => {
      let total = 0;
      for (let i = 0; i + 11 <= line.length; i++) {
        if (hasAt(line, i) || hasRevAt(line, i)) total += 40;
      }
      return total;
    };
    for (let r = 0; r < size; r++) score += scanLine(m[r]);
    for (let c = 0; c < size; c++) score += scanLine(m.map(row => row[c]));

    let dark = 0;
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (m[r][c]) dark++;
    const pct = (dark * 100) / (size * size);
    score += Math.floor(Math.abs(pct - 50) / 5) * 10;

    return score;
  }

  function matrix(text) {
    const bytes = utf8(text);
    const version = pickVersion(bytes.length);
    if (!version) throw new Error('Too much text for a QR code this size');
    const codewords = buildCodewords(bytes, version);
    const base = buildMatrix(version, codewords);

    let best = null, bestScore = Infinity;
    for (let mask = 0; mask < 8; mask++) {
      const grid = applyMask(base, mask);
      const score = penalty(grid);
      if (score < bestScore) { bestScore = score; best = grid; }
    }
    return best;
  }

  /* A plain SVG, sized in modules, with the quiet zone the standard asks for. */
  function svg(text, opts) {
    const o = opts || {};
    const quiet = o.quiet === undefined ? 4 : o.quiet;
    const grid = matrix(text);
    const total = grid.size + quiet * 2;
    const parts = [];
    for (let r = 0; r < grid.size; r++) {
      let c = 0;
      while (c < grid.size) {
        if (!grid.modules[r][c]) { c++; continue; }
        let run = 1;
        while (c + run < grid.size && grid.modules[r][c + run]) run++;
        parts.push(`M${c + quiet} ${r + quiet}h${run}v1h-${run}z`);
        c += run;
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" `
      + `width="${o.width || 200}" height="${o.width || 200}" shape-rendering="crispEdges" role="img" `
      + `aria-label="QR code">`
      + `<rect width="${total}" height="${total}" fill="${o.light || '#ffffff'}"/>`
      + `<path d="${parts.join('')}" fill="${o.dark || '#111827'}"/></svg>`;
  }

  return { matrix, svg };
})();
