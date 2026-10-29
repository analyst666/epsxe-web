/* Banco de jogos (extraido do res/raw/ginfo do ePSXe: ~11k titulos) + deteccao de serial */
let _db;
export async function loadGameDb() {
  if (!_db) _db = fetch("data/gamedb.json").then((r) => r.json()).catch(() => ({}));
  return _db;
}

export const normSerial = (s) => (s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

export function prettySerial(s) {
  const n = normSerial(s);
  return n.length >= 9 ? `${n.slice(0, 4)}-${n.slice(4)}` : s || "";
}

const BOOT_RE = /BOOT\s*=\s*cdrom:?[\\/]*([A-Z]{4}[_-]?\d{3}\.?\d{2})/i;
const ID_RE = /\b(S[CL][EUPK]S|SCED|SCUS|SLPM|SLPS|SLUS|SLES|SCPS|PAPX|PCPX|SIPS|SLKA|SCAJ|SLAJ|LSP|ESPM|PBPX)[-_ ]?(\d{3}\.?\d{2}|\d{5})\b/i;

/** Procura SYSTEM.CNF dentro da imagem de disco (bin/iso/img). */
export async function detectSerialFromImage(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  if (!["bin", "iso", "img", "mdf"].includes(ext)) return null;
  const len = Math.min(file.size, 6 * 1024 * 1024);
  const buf = await file.slice(0, len).arrayBuffer();
  const text = new TextDecoder("latin1").decode(buf);
  const m = text.match(BOOT_RE);
  return m ? normSerial(m[1]) : null;
}

export function serialFromName(name) {
  const m = name.match(ID_RE);
  return m ? normSerial(m[1] + m[2]) : null;
}

export function cleanTitle(filename) {
  if (/240ptestsuite/i.test(filename)) return "240p Test Suite";
  return filename
    .replace(/\.[a-z0-9]{2,4}$/i, "")
    .replace(/\s*[\[(](?:disc|disk|cd)\s*\d+[\])]/gi, (m) => m)
    .replace(/\s*[\[(](?:USA|Europe|Japan|Brazil|En|Fr|De|Es|It|v\d[\d.]*|Rev \w+|SLUS[-_ ]?\d+|SLES[-_ ]?\d+|SCUS[-_ ]?\d+)[^\])]*[\])]/gi, "")
    .replace(/[_]+/g, " ")
    .trim();
}

const REGION_FLAG = { "NTSC-U": "🇺🇸", "NTSC-J": "🇯🇵", PAL: "🇪🇺" };
export const regionFlag = (r) => REGION_FLAG[r] || "💿";

export function searchByTitle(db, title) {
  const t = title.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (t.length < 4) return null;
  for (const k in db) {
    if (db[k].title.toLowerCase().replace(/[^a-z0-9]/g, "") === t) return db[k];
  }
  return null;
}
