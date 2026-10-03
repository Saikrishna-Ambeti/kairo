const MAX_EXPANDED_BYTES = 80 * 1024 * 1024;
const MAX_ENTRY_BYTES = 20 * 1024 * 1024;
const MAX_ENTRIES = 1_000;
const END_SIGNATURE = 0x06054b50;
const ENTRY_SIGNATURE = 0x02014b50;

/** Reject compressed Office files that would expand beyond the sidebar preview budget. */
export function assertOfficeArchiveWithinLimit(buffer: ArrayBuffer): void {
  const view = new DataView(buffer);
  const minimum = Math.max(0, view.byteLength - 22 - 0xffff);
  let end = -1;
  for (let offset = view.byteLength - 22; offset >= minimum; offset--) {
    if (
      view.getUint32(offset, true) === END_SIGNATURE &&
      offset + 22 + view.getUint16(offset + 20, true) === view.byteLength
    ) {
      end = offset;
      break;
    }
  }
  if (end < 0) throw new Error("Invalid Office file archive.");
  const count = view.getUint16(end + 10, true);
  const directorySize = view.getUint32(end + 12, true);
  const directoryOffset = view.getUint32(end + 16, true);
  if (
    view.getUint16(end + 4, true) !== 0 ||
    view.getUint16(end + 6, true) !== 0 ||
    count === 0xffff ||
    count > MAX_ENTRIES ||
    directorySize === 0xffffffff ||
    directoryOffset === 0xffffffff ||
    directoryOffset + directorySize > end
  ) {
    throw new Error("Office file archive is too large or unsupported.");
  }
  let offset = directoryOffset;
  let expanded = 0;
  for (let index = 0; index < count; index++) {
    if (offset + 46 > end || view.getUint32(offset, true) !== ENTRY_SIGNATURE) {
      throw new Error("Invalid Office file archive.");
    }
    const entryBytes = view.getUint32(offset + 24, true);
    if (entryBytes === 0xffffffff || entryBytes > MAX_ENTRY_BYTES) {
      throw new Error("Office file archive is too large to preview.");
    }
    expanded += entryBytes;
    if (expanded > MAX_EXPANDED_BYTES) {
      throw new Error("Office file archive is too large to preview.");
    }
    offset +=
      46 +
      view.getUint16(offset + 28, true) +
      view.getUint16(offset + 30, true) +
      view.getUint16(offset + 32, true);
  }
  if (offset !== directoryOffset + directorySize) {
    throw new Error("Invalid Office file archive.");
  }
}
