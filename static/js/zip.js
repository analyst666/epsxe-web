/* Empacotador ZIP "stored" (sem compressao) -> permite enviar cue+bin(s)/m3u/BIOS ao
   EmulatorJS como um unico arquivo, preservando nomes. CRC32 em streaming. */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crcUpdate(crc, bytes) {
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return crc;
}

async function crc32(blob, onProgress) {
  let crc = 0xffffffff;
  const CH = 8 * 1024 * 1024;
  for (let off = 0; off < blob.size; off += CH) {
    crc = crcUpdate(crc, new Uint8Array(await blob.slice(off, off + CH).arrayBuffer()));
    onProgress?.(Math.min(1, (off + CH) / blob.size));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const enc = new TextEncoder();

/** files: [{name, blob}] -> Blob (application/zip) */
export async function makeZip(files, onProgress) {
  const parts = [];
  const central = [];
  let offset = 0;
  let done = 0;
  const total = files.reduce((a, f) => a + f.blob.size, 0) || 1;
  for (const f of files) {
    const name = enc.encode(f.name);
    const size = f.blob.size;
    if (size >= 0xffffffff) throw new Error(`Arquivo muito grande para ZIP simples: ${f.name}`);
    const crc = await crc32(f.blob, (p) => onProgress?.((done + p * size) / total));
    done += size;
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true);
    lh.setUint16(4, 20, true);
    lh.setUint16(6, 0x0800, true); // UTF-8
    lh.setUint16(8, 0, true);      // stored
    lh.setUint32(14, crc, true);
    lh.setUint32(18, size, true);
    lh.setUint32(22, size, true);
    lh.setUint16(26, name.length, true);
    parts.push(lh.buffer, name, f.blob);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true);
    ch.setUint16(4, 20, true);
    ch.setUint16(6, 20, true);
    ch.setUint16(8, 0x0800, true);
    ch.setUint32(16, crc, true);
    ch.setUint32(20, size, true);
    ch.setUint32(24, size, true);
    ch.setUint16(28, name.length, true);
    ch.setUint32(42, offset, true);
    central.push(ch.buffer, name);
    offset += 30 + name.length + size;
  }
  const cdSize = central.reduce((a, b) => a + (b.byteLength ?? b.length), 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true);
  end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end.buffer], { type: "application/zip" });
}
