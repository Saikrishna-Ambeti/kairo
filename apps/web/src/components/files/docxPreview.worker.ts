import mammoth from "mammoth";

self.onmessage = async (event: MessageEvent<ArrayBuffer>) => {
  try {
    const result = await mammoth.convertToHtml({ arrayBuffer: event.data });
    if (result.value.length > 5_000_000) throw new Error("Document preview is too large.");
    self.postMessage({ html: result.value });
  } catch {
    self.postMessage({ error: "Unable to convert document." });
  }
};
