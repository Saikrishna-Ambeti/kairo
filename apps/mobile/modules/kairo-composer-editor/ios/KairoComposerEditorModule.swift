import ExpoModulesCore
import UIKit

enum KairoComposerClipboard {
  static let fragmentType = "app.kairo.context-fragment"

  static func write(text: String, fragment: String) {
    var items: [String: Any] = ["public.utf8-plain-text": text]
    if let data = fragment.data(using: .utf8),
       var payload = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
       let records = payload["records"] as? [[String: Any]] {
      var selected = records.filter { record in
        guard let id = record["contextId"] as? String else { return false }
        return text.contains("/\(id))")
      }
      let screenshots = Set(selected.compactMap { $0["screenshotContextId"] as? String })
      selected.append(contentsOf: records.filter { screenshots.contains($0["contextId"] as? String ?? "") && !text.contains("/\($0["contextId"] as? String ?? ""))") })
      payload["records"] = selected
      if !selected.isEmpty, let encoded = try? JSONSerialization.data(withJSONObject: payload), let raw = String(data: encoded, encoding: .utf8) {
        let attribute = raw.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? ""
        let escaped = text.replacingOccurrences(of: "&", with: "&amp;").replacingOccurrences(of: "<", with: "&lt;").replacingOccurrences(of: ">", with: "&gt;")
        items[fragmentType] = encoded
        items["public.html"] = Data("<pre data-kairo-context-fragment=\"\(attribute)\">\(escaped)</pre>".utf8)
      }
    }
    UIPasteboard.general.items = [items]
  }

  static func read() -> [String: String] {
    let board = UIPasteboard.general
    return [
      "text": board.string ?? "",
      "fragment": board.data(forPasteboardType: fragmentType).flatMap { String(data: $0, encoding: .utf8) } ?? "",
      "html": board.data(forPasteboardType: "public.html").flatMap { String(data: $0, encoding: .utf8) } ?? "",
    ]
  }
}

public class KairoComposerEditorModule: Module {
  public func definition() -> ModuleDefinition {
    Name("KairoComposerEditor")

    AsyncFunction("writeContextClipboard") { (text: String, fragment: String) in
      KairoComposerClipboard.write(text: text, fragment: fragment)
    }.runOnQueue(.main)

    View(KairoComposerEditorView.self) {
      Prop("controlledDocumentJson") { (view: KairoComposerEditorView, documentJson: String) in
        view.setControlledDocumentJson(documentJson)
      }
      Prop("themeJson") { (view: KairoComposerEditorView, themeJson: String) in
        view.setThemeJson(themeJson)
      }
      Prop("clipboardFragment") { (view: KairoComposerEditorView, fragment: String) in
        view.setClipboardFragment(fragment)
      }
      Prop("placeholder") { (view: KairoComposerEditorView, placeholder: String) in
        view.setPlaceholder(placeholder)
      }
      Prop("fontFamily") { (view: KairoComposerEditorView, fontFamily: String) in
        view.setFontFamily(fontFamily)
      }
      Prop("fontSize") { (view: KairoComposerEditorView, fontSize: Double) in
        view.setFontSize(CGFloat(fontSize))
      }
      Prop("lineHeight") { (view: KairoComposerEditorView, lineHeight: Double) in
        view.setLineHeight(CGFloat(lineHeight))
      }
      Prop("contentInsetVertical") { (view: KairoComposerEditorView, contentInsetVertical: Double) in
        view.setContentInsetVertical(CGFloat(contentInsetVertical))
      }
      Prop("editable") { (view: KairoComposerEditorView, editable: Bool) in
        view.setEditable(editable)
      }
      Prop("readOnly") { (view: KairoComposerEditorView, readOnly: Bool) in
        view.setReadOnly(readOnly)
      }
      Prop("scrollEnabled") { (view: KairoComposerEditorView, scrollEnabled: Bool) in
        view.setScrollEnabled(scrollEnabled)
      }
      Prop("autoFocus") { (view: KairoComposerEditorView, autoFocus: Bool) in
        view.setAutoFocus(autoFocus)
      }
      Prop("autoCorrect") { (view: KairoComposerEditorView, autoCorrect: Bool) in
        view.setAutoCorrect(autoCorrect)
      }
      Prop("spellCheck") { (view: KairoComposerEditorView, spellCheck: Bool) in
        view.setSpellCheck(spellCheck)
      }
      Prop("enterBehavior") { (view: KairoComposerEditorView, behavior: String) in
        view.setEnterBehavior(behavior)
      }
      Prop("textPasteThresholdBytes") { (view: KairoComposerEditorView, threshold: Int) in
        view.setTextPasteThresholdBytes(threshold)
      }
      Prop("maxInputChars") { (view: KairoComposerEditorView, maxInputChars: Int) in
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
        "onComposerContentSizeChange"
      )

      AsyncFunction("focus") { (view: KairoComposerEditorView) in
        view.focusEditor()
      }
      AsyncFunction("blur") { (view: KairoComposerEditorView) in
        view.blurEditor()
      }
      AsyncFunction("setSelection") { (view: KairoComposerEditorView, start: Int, end: Int) in
        view.setSelection(start: start, end: end)
      }
    }
  }
}
