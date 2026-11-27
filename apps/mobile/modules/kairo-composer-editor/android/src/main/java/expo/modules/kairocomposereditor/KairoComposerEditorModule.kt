package expo.modules.kairocomposereditor

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import org.json.JSONObject
import org.json.JSONArray

internal object KairoComposerClipboard {
  // Pasted thread links become chips in JS; packages/shared/src/threadLinks.ts parses them.
  fun hasThreadLink(text: String): Boolean =
    text.contains("kairo-thread://v2/") || text.contains("https://app.kairo.codes/threads/")

  // Clipboard bridges can echo our text back without its HTML context metadata.
  private var copiedContext: Pair<String, String>? = null

  @Synchronized
  fun write(context: Context, text: String, fragment: String) {
    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    val payload = try {
      JSONObject(fragment)
    } catch (_: Exception) {
      null
    }
    val records = payload?.optJSONArray("records")
    if (payload == null || records == null) {
      copiedContext = null
      clipboard.setPrimaryClip(ClipData.newPlainText("Kairo", text))
      return
    }
    val all = (0 until records.length()).map { records.getJSONObject(it) }
    val selected = all.filter { text.contains("/${it.optString("contextId")})") }.toMutableList()
    val screenshots = selected.map { it.optString("screenshotContextId") }.toSet()
    selected.addAll(
      all.filter {
        screenshots.contains(it.optString("contextId")) &&
          !selected.contains(it)
      }
    )
    payload.put("records", JSONArray(selected))
    val serialized = payload.toString()
    val encoded = java.net.URLEncoder.encode(serialized, "UTF-8").replace("+", "%20")
    val escaped = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    copiedContext = if (selected.isEmpty()) null else text to serialized
    clipboard.setPrimaryClip(
      if (selected.isEmpty()) {
        ClipData.newPlainText(
          "Kairo",
          text
        )
      } else {
        ClipData.newHtmlText(
          "Kairo",
          text,
          "<pre data-kairo-context-fragment=\"$encoded\">$escaped</pre>"
        )
      }
    )
  }

  @Synchronized
  fun read(context: Context): Map<String, String> {
    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    val clip = clipboard.primaryClip
    val item = if (clip != null && clip.itemCount > 0) clip.getItemAt(0) else null
    val text = item?.text?.toString() ?: ""
    val html = item?.htmlText ?: ""
    val copied = copiedContext?.takeIf {
      clip?.itemCount == 1 && item?.uri == null && it.first == text
    }
    if (copied == null) copiedContext = null
    return mapOf(
      "text" to text,
      "html" to html,
      "fragment" to
        if (!html.contains("data-kairo-context-fragment=")) copied?.second.orEmpty() else ""
    )
  }
}

class KairoComposerEditorModule : Module() {
  @Suppress("LongMethod") // A flat list of the view's props and events.
  override fun definition() = ModuleDefinition {
    Name("KairoComposerEditor")

    AsyncFunction("writeContextClipboard") { text: String, fragment: String ->
      KairoComposerClipboard.write(requireNotNull(appContext.reactContext), text, fragment)
    }

    View(KairoComposerEditorView::class) {
      Prop("controlledDocumentJson") { view: KairoComposerEditorView, documentJson: String ->
        view.setControlledDocumentJson(documentJson)
      }
      Prop("themeJson") { view: KairoComposerEditorView, themeJson: String ->
        view.setThemeJson(themeJson)
      }
      Prop("clipboardFragment") { view: KairoComposerEditorView, fragment: String ->
        view.setClipboardFragment(fragment)
      }
      Prop("placeholder") { view: KairoComposerEditorView, placeholder: String ->
        view.setPlaceholder(placeholder)
      }
      Prop("fontFamily") { view: KairoComposerEditorView, fontFamily: String ->
        view.setFontFamily(fontFamily)
      }
      Prop("fontSize") { view: KairoComposerEditorView, fontSize: Double ->
        view.setFontSize(fontSize.toFloat())
      }
      Prop("lineHeight") { view: KairoComposerEditorView, lineHeight: Double ->
        view.setLineHeight(lineHeight.toFloat())
      }
      Prop("contentInsetVertical") { view: KairoComposerEditorView, contentInsetVertical: Double ->
        view.setContentInsetVertical(contentInsetVertical.toInt())
      }

      Prop("singleLineCentered") { view: KairoComposerEditorView, singleLineCentered: Boolean ->
        view.setSingleLineCentered(singleLineCentered)
      }
      Prop("editable") { view: KairoComposerEditorView, editable: Boolean ->
        view.setEditable(editable)
      }
      Prop("readOnly") { view: KairoComposerEditorView, readOnly: Boolean ->
        view.setReadOnly(readOnly)
      }
      Prop("enterBehavior") { view: KairoComposerEditorView, behavior: String ->
        view.setEnterBehavior(behavior)
      }
      Prop("submitEnabled") { view: KairoComposerEditorView, enabled: Boolean ->
        view.setSubmitEnabled(enabled)
      }
      Prop("scrollEnabled") { view: KairoComposerEditorView, scrollEnabled: Boolean ->
        view.setScrollEnabled(scrollEnabled)
      }
      Prop("autoFocus") { view: KairoComposerEditorView, autoFocus: Boolean ->
        view.setAutoFocus(autoFocus)
      }
      Prop("autoCorrect") { view: KairoComposerEditorView, autoCorrect: Boolean ->
        view.setAutoCorrect(autoCorrect)
      }
      Prop("spellCheck") { view: KairoComposerEditorView, spellCheck: Boolean ->
        view.setSpellCheck(spellCheck)
      }
      Prop("textPasteThresholdBytes") { view: KairoComposerEditorView, threshold: Int ->
        view.setTextPasteThresholdBytes(threshold)
      }
      Prop("maxInputChars") { view: KairoComposerEditorView, maxInputChars: Int ->
        view.setMaxInputChars(maxInputChars)
      }

      Events(
        "onComposerChange",
        "onComposerSelectionChange",
        "onComposerFocus",
        "onComposerBlur",
        "onComposerSubmit",
        "onComposerPasteImages",
        "onComposerContextPress",
        "onComposerPasteContext",
        "onComposerPasteText",
        "onComposerContentSizeChange",
      )

      AsyncFunction("focus") { view: KairoComposerEditorView ->
        view.focusEditor()
      }
      AsyncFunction("blur") { view: KairoComposerEditorView ->
        view.blurEditor()
      }
      AsyncFunction("setSelection") { view: KairoComposerEditorView, start: Int, end: Int ->
        view.setSelection(start, end)
      }
    }
  }
}
