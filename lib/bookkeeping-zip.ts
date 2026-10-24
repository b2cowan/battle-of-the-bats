/** Small stored-file ZIP writer. Receipts are already compressed; this keeps one receipt in memory at a time. */
export type ZipEntry = { name: string; load: () => Promise<Uint8Array> };

const encoder = new TextEncoder();
const table = Uint32Array.from({ length: 256 }, (_, n) => {
  let value = n;
  for (let i = 0; i < 8; i++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function header(size: number): { bytes: Uint8Array; view: DataView } {
  const bytes = new Uint8Array(size);
  return { bytes, view: new DataView(bytes.buffer) };
}

export async function* storedZip(entries: ZipEntry[]): AsyncGenerator<Uint8Array> {
  const central: Uint8Array[] = [];
  let offset = 0;
  if (entries.length > 65535) throw new Error('Too many ZIP entries');
  for (const entry of entries) {
    if (!entry.name || entry.name.startsWith('/') || entry.name.split('/').includes('..')) throw new Error('Unsafe ZIP path');
    const name = encoder.encode(entry.name);
    const data = await entry.load();
    if (name.length > 65535 || data.length > 0xffffffff || offset > 0xffffffff) throw new Error('ZIP size limit reached');
    const crc = crc32(data);
    const local = header(30 + name.length);
    local.view.setUint32(0, 0x04034b50, true);
    local.view.setUint16(4, 20, true);
    local.view.setUint16(6, 0x0800, true); // UTF-8 file names
    local.view.setUint32(14, crc, true);
    local.view.setUint32(18, data.length, true);
    local.view.setUint32(22, data.length, true);
    local.view.setUint16(26, name.length, true);
    local.bytes.set(name, 30);
    const directory = header(46 + name.length);
    directory.view.setUint32(0, 0x02014b50, true);
    directory.view.setUint16(4, 20, true);
    directory.view.setUint16(6, 20, true);
    directory.view.setUint16(8, 0x0800, true);
    directory.view.setUint32(16, crc, true);
    directory.view.setUint32(20, data.length, true);
    directory.view.setUint32(24, data.length, true);
    directory.view.setUint16(28, name.length, true);
    directory.view.setUint32(42, offset, true);
    directory.bytes.set(name, 46);
    central.push(directory.bytes);
    offset += local.bytes.length + data.length;
    yield local.bytes;
    yield data;
  }
  const directoryStart = offset;
  for (const part of central) { yield part; offset += part.length; }
  if (offset > 0xffffffff) throw new Error('ZIP size limit reached');
  const end = header(22);
  end.view.setUint32(0, 0x06054b50, true);
  end.view.setUint16(8, central.length, true);
  end.view.setUint16(10, central.length, true);
  end.view.setUint32(12, offset - directoryStart, true);
  end.view.setUint32(16, directoryStart, true);
  yield end.bytes;
}

export function zipStream(entries: ZipEntry[]): ReadableStream<Uint8Array> {
  const iterator = storedZip(entries);
  return new ReadableStream({
    async pull(controller) {
      try {
        const next = await iterator.next();
        if (next.done) controller.close(); else controller.enqueue(next.value);
      } catch (error) { controller.error(error); }
    },
    async cancel() { await iterator.return(undefined); },
  });
}
