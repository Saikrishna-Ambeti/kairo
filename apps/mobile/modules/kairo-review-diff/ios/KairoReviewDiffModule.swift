import ExpoModulesCore

public class KairoReviewDiffModule: Module {
  public func definition() -> ModuleDefinition {
    Name("KairoReviewDiffSurface")

    View(KairoReviewDiffView.self) {
      Prop("contentInsetTop") { (view: KairoReviewDiffView, value: Double) in
        view.setContentInsetTop(CGFloat(value))
      }

      Prop("contentInsetBottom") { (view: KairoReviewDiffView, value: Double) in
        view.setContentInsetBottom(CGFloat(value))
      }

      Prop("tokensResetKey") { (view: KairoReviewDiffView, tokensResetKey: String) in
        view.setTokensResetKey(tokensResetKey)
      }

      Prop("contentResetKey") { (view: KairoReviewDiffView, contentResetKey: String) in
        view.setContentResetKey(contentResetKey)
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

      Prop("initialRowIndex") { (view: KairoReviewDiffView, initialRowIndex: Double) in
        view.setInitialRowIndex(initialRowIndex)
      }

      Prop("initialFileId") { (view: KairoReviewDiffView, fileId: String) in
        view.setInitialFileId(fileId)
      }

      Prop("scrollEnabled") { (view: KairoReviewDiffView, enabled: Bool) in
        view.setScrollEnabled(enabled)
      }

      Prop("bounces") { (view: KairoReviewDiffView, bounces: Bool) in
        view.setBounces(bounces)
      }

      Prop("refreshEnabled") { (view: KairoReviewDiffView, enabled: Bool) in
        view.setRefreshEnabled(enabled)
      }

      Prop("refreshing") { (view: KairoReviewDiffView, refreshing: Bool) in
        view.setRefreshing(refreshing)
      }

      Events(
        "onDebug",
        "onVisibleFileChange",
        "onToggleFile",
        "onToggleViewedFile",
        "onPressLine",
        "onToggleComment",
        "onPressNotice",
        "onPullToRefresh"
      )

      AsyncFunction("scrollToFile") { (view: KairoReviewDiffView, fileId: String, animated: Bool) in
        view.scrollToFile(fileId, animated: animated)
      }

      AsyncFunction("scrollToTop") { (view: KairoReviewDiffView, animated: Bool) in
        view.scrollToTop(animated: animated)
      }

      // Large, frequently changing JSON values cannot be regular Fabric props. Expo's
      // prop adapter compares strings on the main thread before invoking a setter, which
      // makes a syntax-token patch capable of blocking a frame by itself.
      AsyncFunction("setRowsJson") { (view: KairoReviewDiffView, rowsJson: String, contentResetKey: String) in
        view.setContentResetKey(contentResetKey)
        view.setRowsJson(rowsJson)
      }

      AsyncFunction("setTokensJson") { (view: KairoReviewDiffView, tokensJson: String) in
        view.setTokensJson(tokensJson)
      }

      AsyncFunction("setTokensPatchJson") { (view: KairoReviewDiffView, tokensPatchJson: String, promise: Promise) in
        view.setTokensPatchJson(tokensPatchJson) { accepted in
          promise.resolve(accepted)
        }
      }
    }
  }
}
