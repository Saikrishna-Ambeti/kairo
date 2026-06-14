import ExpoModulesCore

public class KairoReviewDiffModule: Module {
  public func definition() -> ModuleDefinition {
    Name("KairoReviewDiffSurface")

    View(KairoReviewDiffView.self) {
      Prop("rowsJson") { (view: KairoReviewDiffView, rowsJson: String) in
        view.setRowsJson(rowsJson)
      }

      Prop("tokensJson") { (view: KairoReviewDiffView, tokensJson: String) in
        view.setTokensJson(tokensJson)
      }

      Prop("tokensPatchJson") { (view: KairoReviewDiffView, tokensPatchJson: String) in
        view.setTokensPatchJson(tokensPatchJson)
      }

      Prop("tokensResetKey") { (view: KairoReviewDiffView, tokensResetKey: String) in
        view.setTokensResetKey(tokensResetKey)
      }

      Prop("collapsedFileIdsJson") { (view: KairoReviewDiffView, collapsedFileIdsJson: String) in
        view.setCollapsedFileIdsJson(collapsedFileIdsJson)
      }

      Prop("viewedFileIdsJson") { (view: KairoReviewDiffView, viewedFileIdsJson: String) in
        view.setViewedFileIdsJson(viewedFileIdsJson)
      }

      Prop("selectedRowIdsJson") { (view: KairoReviewDiffView, selectedRowIdsJson: String) in
        view.setSelectedRowIdsJson(selectedRowIdsJson)
      }

      Prop("collapsedCommentIdsJson") { (view: KairoReviewDiffView, collapsedCommentIdsJson: String) in
        view.setCollapsedCommentIdsJson(collapsedCommentIdsJson)
      }

      Prop("appearanceScheme") { (view: KairoReviewDiffView, appearanceScheme: String) in
        view.setAppearanceScheme(appearanceScheme)
      }

      Prop("themeJson") { (view: KairoReviewDiffView, themeJson: String) in
        view.setThemeJson(themeJson)
      }

      Prop("styleJson") { (view: KairoReviewDiffView, styleJson: String) in
        view.setStyleJson(styleJson)
      }

      Prop("rowHeight") { (view: KairoReviewDiffView, rowHeight: Double) in
        view.setRowHeight(CGFloat(rowHeight))
      }

      Prop("contentWidth") { (view: KairoReviewDiffView, contentWidth: Double) in
        view.setContentWidth(CGFloat(contentWidth))
      }

      Events("onDebug", "onToggleFile", "onToggleViewedFile", "onPressLine", "onToggleComment")
    }
  }
}
