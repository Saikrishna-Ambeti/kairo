import ExpoModulesCore

public class KairoTerminalModule: Module {
  public func definition() -> ModuleDefinition {
    Name("KairoTerminalSurface")

    View(KairoTerminalView.self) {
      Prop("terminalKey") { (view: KairoTerminalView, terminalKey: String) in
        view.terminalKey = terminalKey
      }

      Prop("initialBuffer") { (view: KairoTerminalView, initialBuffer: String) in
        view.initialBuffer = initialBuffer
      }

      Prop("fontSize") { (view: KairoTerminalView, fontSize: Double) in
        view.fontSize = CGFloat(fontSize)
      }

      Prop("appearanceScheme") { (view: KairoTerminalView, appearanceScheme: String) in
        view.appearanceScheme = appearanceScheme
      }

      Prop("themeConfig") { (view: KairoTerminalView, themeConfig: String) in
        view.themeConfig = themeConfig
      }

      Prop("backgroundColor") { (view: KairoTerminalView, backgroundColor: String) in
        view.backgroundColorHex = backgroundColor
      }

      Prop("foregroundColor") { (view: KairoTerminalView, foregroundColor: String) in
        view.foregroundColorHex = foregroundColor
      }

      Prop("mutedForegroundColor") { (view: KairoTerminalView, mutedForegroundColor: String) in
        view.mutedForegroundColorHex = mutedForegroundColor
      }

      Events("onInput", "onResize")
    }
  }
}
