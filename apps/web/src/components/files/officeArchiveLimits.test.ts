import JSZip from "jszip";
import { describe, expect, it } from "vite-plus/test";

import { assertOfficeArchiveWithinLimit } from "./officeArchiveLimits";

describe("Office archive preview limits", () => {
  it("accepts a small archive", async () => {
    const zip = new JSZip();
    zip.file("word/document.xml", "<w:document>hello</w:document>");
    const buffer = await zip.generateAsync({ type: "arraybuffer" });
    expect(() => assertOfficeArchiveWithinLimit(buffer)).not.toThrow();
  });

  it("rejects an archive that advertises excessive expanded data", async () => {
    const zip = new JSZip();
    zip.file("word/document.xml", "small compressed data");
    const buffer = await zip.generateAsync({ type: "arraybuffer" });
    const bytes = new DataView(buffer);
    for (let offset = 0; offset < buffer.byteLength - 46; offset++) {
      if (bytes.getUint32(offset, true) !== 0x02014b50) continue;
      bytes.setUint32(offset + 24, 21 * 1024 * 1024, true);
      break;
    }
    expect(() => assertOfficeArchiveWithinLimit(buffer)).toThrow("too large to preview");
  });

  it("rejects a truncated archive", () => {
    expect(() => assertOfficeArchiveWithinLimit(new ArrayBuffer(12))).toThrow("Invalid Office");
  });

  it("rejects uncounted central directory entries", async () => {
    const zip = new JSZip();
    zip.file("word/document.xml", "hello");
    zip.file("word/styles.xml", "styles");
    const buffer = await zip.generateAsync({ type: "arraybuffer" });
    const view = new DataView(buffer);
    for (let offset = buffer.byteLength - 22; offset >= 0; offset--) {
      if (view.getUint32(offset, true) !== 0x06054b50) continue;
      view.setUint16(offset + 10, 1, true);
      break;
    }
    expect(() => assertOfficeArchiveWithinLimit(buffer)).toThrow("Invalid Office");
  });
});
