package expo.modules.kairoterminal

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class KairoTerminalModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("KairoTerminalSurface")

    // Bumped when native hardware-keyboard handling changes; surfaced in the JS debug
    // logs so a stale native binary is distinguishable from a broken key pipeline.
    Constants(
      "hardwareKeyRevision" to 2,
      "outputRevision" to 1,
    )

    View(KairoTerminalView::class) {
      AsyncFunction("writeOutput") { view: KairoTerminalView, data: String, reset: Boolean ->
        view.writeOutput(data, reset)
      }

      // The Android input field already clears after every change.
      AsyncFunction("resetInput") { _: KairoTerminalView -> }

      Prop("terminalKey") { view: KairoTerminalView, terminalKey: String ->
        view.terminalKey = terminalKey
      }

      Prop("initialBuffer") { view: KairoTerminalView, initialBuffer: String ->
        view.initialBuffer = initialBuffer
      }

      Prop("fontSize") { view: KairoTerminalView, fontSize: Double ->
        view.fontSize = fontSize.toFloat()
      }

      Prop("focusRequest") { view: KairoTerminalView, focusRequest: Double ->
        view.focusRequest = focusRequest
      }

      Prop("readOnly") { view: KairoTerminalView, readOnly: Boolean ->
        view.readOnly = readOnly
      }

      Prop("autoFocus") { view: KairoTerminalView, autoFocus: Boolean ->
        view.autoFocus = autoFocus
      }

      Prop("appearanceScheme") { view: KairoTerminalView, appearanceScheme: String ->
        view.appearanceScheme = appearanceScheme
      }

      Prop("themeConfig") { view: KairoTerminalView, themeConfig: String ->
        view.themeConfig = themeConfig
      }

      Prop("backgroundColor") { view: KairoTerminalView, backgroundColor: String ->
        view.backgroundColorHex = backgroundColor
      }

      Prop("foregroundColor") { view: KairoTerminalView, foregroundColor: String ->
        view.foregroundColorHex = foregroundColor
      }

      Prop("mutedForegroundColor") { view: KairoTerminalView, mutedForegroundColor: String ->
        view.mutedForegroundColorHex = mutedForegroundColor
      }

      Prop("captureRequest") { view: KairoTerminalView, request: Double ->
        view.captureRequest = request
      }

      Prop("sharedGrid") { view: KairoTerminalView, sharedGrid: List<Int> ->
        view.sharedGrid = sharedGrid
      }
      Events("onInput", "onResize", "onCapture")

      OnViewDidUpdateProps { view: KairoTerminalView ->
        view.applyPendingBuffer()
      }

      OnViewDestroys { view: KairoTerminalView ->
        view.cleanup()
      }
    }
  }
}
