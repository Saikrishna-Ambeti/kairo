import { getSlides, loadPresentation } from "@office-kit/pptx";
import { renderSlideToSvg } from "@office-kit/pptx-preview";

const MAX_SLIDES = 100;
const MAX_HTML_LENGTH = 12_000_000;

self.addEventListener("message", async (event: MessageEvent<ArrayBuffer>) => {
  try {
    const presentation = await loadPresentation(new Uint8Array(event.data));
    const slides = getSlides(presentation);
    let html = "";
    for (const [index, slide] of slides.slice(0, MAX_SLIDES).entries()) {
      html += `<section class="slide"><p class="slide-label">Slide ${index + 1}</p>${renderSlideToSvg(presentation, slide)}</section>`;
      if (html.length > MAX_HTML_LENGTH) throw new Error("Presentation preview is too large.");
    }
    if (slides.length > MAX_SLIDES) {
      html += `<p class="preview-note">Showing the first ${MAX_SLIDES} of ${slides.length} slides. Download the file to see the rest.</p>`;
    }
    self.postMessage({ html });
  } catch {
    self.postMessage({ error: "Unable to render presentation." });
  }
});
