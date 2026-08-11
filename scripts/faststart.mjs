/* -----------------------------------------------------------------------
   faststart.mjs — move the `moov` atom to the front of an MP4
   ─────────────────────────────────────────────────────────────────────
   An MP4 with its `moov` (the index: track table, sample sizes, chunk
   offsets) written *after* the `mdat` (the actual frames) cannot start
   playing until essentially the whole file has arrived, because the player
   has no idea where anything is until it reads the index. Moving `moov` to
   the front lets playback begin as soon as the first chunks land.

   This is a pure re-order — not a re-encode. Every byte of video data is
   preserved exactly; only the box order and the chunk-offset tables change.

   `moov` holds absolute file offsets for every chunk (stco = 32-bit,
   co64 = 64-bit), so relocating boxes means rewriting those tables by
   however far each chunk moved.

   Usage:  node scripts/faststart.mjs public/videos/*.mp4
           node scripts/faststart.mjs --dry-run public/videos/video1x.mp4

   Originals are written to .video-originals/<name>.orig.mp4 (gitignored, and
   deliberately outside public/ so backups are never served or deployed).
   Pass --no-backup to skip them.
   ----------------------------------------------------------------------- */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { basename, join } from "node:path";

/** Backups live outside public/ so they are never served or deployed. */
const BACKUP_DIR = ".video-originals";

/** Walk the boxes in [start, end), calling cb(type, payloadStart, boxEnd, boxStart). */
function eachBox(buf, start, end, cb) {
  let o = start;
  while (o + 8 <= end) {
    let size = buf.readUInt32BE(o);
    const type = buf.toString("latin1", o + 4, o + 8);
    let header = 8;
    if (size === 1) {
      size = Number(buf.readBigUInt64BE(o + 8));
      header = 16;
    }
    if (size === 0) size = end - o; // extends to EOF
    if (size < header || o + size > end) break;
    cb(type, o + header, o + size, o);
    o += size;
  }
}

/** Boxes that hold children after a fixed prefix rather than immediately. */
const CONTAINER_PREFIX = { stsd: 8, meta: 4 };
const CONTAINERS = new Set([
  "moov", "trak", "mdia", "minf", "stbl", "edts", "udta", "mvex", "moof", "traf",
]);

/** Collect every stco/co64 box inside a region. */
function findOffsetTables(buf, start, end, out = []) {
  eachBox(buf, start, end, (type, s, e) => {
    if (type === "stco" || type === "co64") out.push({ type, start: s, end: e });
    else if (CONTAINERS.has(type)) findOffsetTables(buf, s + (CONTAINER_PREFIX[type] || 0), e, out);
  });
  return out;
}

function faststart(buf) {
  // Top-level layout.
  const top = [];
  eachBox(buf, 0, buf.length, (type, _s, boxEnd, boxStart) => {
    top.push({ type, start: boxStart, end: boxEnd });
  });

  const moov = top.find((b) => b.type === "moov");
  const mdat = top.find((b) => b.type === "mdat");
  if (!moov) return { status: "no-moov" };
  if (!mdat) return { status: "no-mdat" };
  if (moov.start < mdat.start) return { status: "already" };

  // New order: ftyp (if present) → moov → everything else, order preserved.
  const ftyp = top.find((b) => b.type === "ftyp");
  const rest = top.filter((b) => b !== moov && b !== ftyp);
  const ordered = [...(ftyp ? [ftyp] : []), moov, ...rest];

  // Where each box lands, so we know how far its contents moved.
  const shift = new Map();
  let cursor = 0;
  for (const box of ordered) {
    shift.set(box, cursor - box.start);
    cursor += box.end - box.start;
  }

  // Rewrite the chunk-offset tables against the new layout. Work on a copy of
  // moov so the source buffer stays pristine while we look offsets up in it.
  const moovBuf = Buffer.from(buf.subarray(moov.start, moov.end));
  const tables = findOffsetTables(moovBuf, 8, moovBuf.length);

  let patched = 0;
  for (const table of tables) {
    const count = moovBuf.readUInt32BE(table.start + 4); // after version+flags
    let p = table.start + 8;
    for (let i = 0; i < count; i++) {
      const is64 = table.type === "co64";
      const oldOffset = is64 ? Number(moovBuf.readBigUInt64BE(p)) : moovBuf.readUInt32BE(p);

      // Which top-level box does this chunk live in? That box's shift is ours.
      const owner = top.find((b) => oldOffset >= b.start && oldOffset < b.end);
      const delta = owner ? shift.get(owner) ?? 0 : 0;
      const next = oldOffset + delta;

      if (!is64 && next > 0xffffffff) {
        // Would need co64; bail rather than silently corrupt the file.
        return { status: "needs-co64" };
      }
      if (is64) moovBuf.writeBigUInt64BE(BigInt(next), p);
      else moovBuf.writeUInt32BE(next, p);

      p += is64 ? 8 : 4;
      patched++;
    }
  }

  const out = Buffer.concat(
    ordered.map((b) => (b === moov ? moovBuf : buf.subarray(b.start, b.end))),
  );

  if (out.length !== buf.length) return { status: "size-drift" };
  return { status: "ok", buf: out, patched, moovSize: moov.end - moov.start };
}

/* --- CLI ------------------------------------------------------------- */

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const noBackup = args.includes("--no-backup");
const files = args.filter((a) => !a.startsWith("--"));

if (files.length === 0) {
  console.error("usage: node scripts/faststart.mjs [--dry-run] [--no-backup] <file.mp4>...");
  process.exit(1);
}

for (const file of files) {
  const buf = readFileSync(file);
  const result = faststart(buf);
  const mb = (buf.length / 1e6).toFixed(1);

  switch (result.status) {
    case "already":
      console.log(`- ${file}  (${mb} MB) already faststart, skipped`);
      break;
    case "ok": {
      console.log(
        `+ ${file}  (${mb} MB)  moov ${(result.moovSize / 1024).toFixed(0)} KB moved to front, ` +
          `${result.patched} chunk offsets rewritten${dryRun ? "  [dry run]" : ""}`,
      );
      if (dryRun) break;
      const backup = join(BACKUP_DIR, basename(file).replace(/\.mp4$/i, ".orig.mp4"));
      if (!noBackup && !existsSync(backup)) {
        mkdirSync(BACKUP_DIR, { recursive: true });
        writeFileSync(backup, buf);
      }
      writeFileSync(file, result.buf);
      break;
    }
    default:
      console.log(`! ${file}  (${mb} MB) not rewritten: ${result.status}`);
  }
}
