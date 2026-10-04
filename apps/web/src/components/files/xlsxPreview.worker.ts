import readXlsxFile from "read-excel-file/universal";

const MAX_SHEETS = 20;
const MAX_ROWS_PER_SHEET = 1_000;
const MAX_COLUMNS_PER_SHEET = 50;
const MAX_HTML_LENGTH = 5_000_000;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

function columnLabel(index: number): string {
  let label = "";
  for (let number = index + 1; number > 0; number = Math.floor((number - 1) / 26)) {
    label = String.fromCharCode(65 + ((number - 1) % 26)) + label;
  }
  return label;
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return escapeHtml(value instanceof Date ? value.toLocaleDateString() : String(value));
}

self.addEventListener("message", async (event: MessageEvent<ArrayBuffer>) => {
  try {
    const sheets = await readXlsxFile(event.data);
    let html = "";
    for (const sheet of sheets.slice(0, MAX_SHEETS)) {
      const rows = sheet.data.slice(0, MAX_ROWS_PER_SHEET);
      const columnCount = Math.min(
        MAX_COLUMNS_PER_SHEET,
        Math.max(0, ...rows.map((row) => row.length)),
      );
      html += `<section class="sheet"><h2>${escapeHtml(sheet.sheet)}</h2><div class="sheet-scroll"><table><thead><tr><th></th>`;
      for (let column = 0; column < columnCount; column++) {
        html += `<th>${columnLabel(column)}</th>`;
      }
      html += "</tr></thead><tbody>";
      for (const [index, row] of rows.entries()) {
        html += `<tr><th>${index + 1}</th>`;
        for (let column = 0; column < columnCount; column++) {
          html += `<td>${cellText(row[column])}</td>`;
        }
        html += "</tr>";
        if (html.length > MAX_HTML_LENGTH) throw new Error("Spreadsheet preview is too large.");
      }
      html += "</tbody></table></div>";
      if (
        sheet.data.length > MAX_ROWS_PER_SHEET ||
        sheet.data.some((row) => row.length > MAX_COLUMNS_PER_SHEET)
      ) {
        html +=
          '<p class="preview-note">Preview shortened. Download the file to see all cells.</p>';
      }
      html += "</section>";
    }
    if (sheets.length > MAX_SHEETS) {
      html += `<p class="preview-note">Showing the first ${MAX_SHEETS} of ${sheets.length} sheets. Download the file to see the rest.</p>`;
    }
    self.postMessage({ html });
  } catch {
    self.postMessage({ error: "Unable to render spreadsheet." });
  }
});
