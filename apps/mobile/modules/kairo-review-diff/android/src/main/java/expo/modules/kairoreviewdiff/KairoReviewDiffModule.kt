package expo.modules.kairoreviewdiff

import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private val REVIEW_DIFF_EVENTS = arrayOf(
  "onDebug",
  "onVisibleFileChange",
  "onToggleFile",
  "onToggleViewedFile",
  "onPressLine",
  "onToggleComment",
  "onPressNotice",
)

class KairoReviewDiffModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("KairoReviewDiffSurface")

    View(KairoReviewDiffView::class) {
      Prop("tokensResetKey") { view: KairoReviewDiffView, tokensResetKey: String ->
        view.setTokensResetKey(tokensResetKey)
      }
      Prop("contentResetKey") { view: KairoReviewDiffView, contentResetKey: String ->
        view.setContentResetKey(contentResetKey)
      }
      Prop("collapsedFileIdsJson") { view: KairoReviewDiffView, collapsedFileIdsJson: String ->
        view.setCollapsedFileIdsJson(collapsedFileIdsJson)
      }
      Prop("viewedFileIdsJson") { view: KairoReviewDiffView, viewedFileIdsJson: String ->
        view.setViewedFileIdsJson(viewedFileIdsJson)
      }
      Prop("selectedRowIdsJson") { view: KairoReviewDiffView, selectedRowIdsJson: String ->
        view.setSelectedRowIdsJson(selectedRowIdsJson)
      }
      Prop("collapsedCommentIdsJson") { view: KairoReviewDiffView, collapsedCommentIdsJson: String ->
        view.setCollapsedCommentIdsJson(collapsedCommentIdsJson)
      }
      Prop("appearanceScheme") { view: KairoReviewDiffView, appearanceScheme: String ->
        view.setAppearanceScheme(appearanceScheme)
      }
      Prop("themeJson") { view: KairoReviewDiffView, themeJson: String ->
        view.setThemeJson(themeJson)
      }
      Prop("styleJson") { view: KairoReviewDiffView, styleJson: String ->
        view.setStyleJson(styleJson)
      }
      Prop("rowHeight") { view: KairoReviewDiffView, rowHeight: Double ->
        view.setRowHeight(rowHeight.toFloat())
      }
      // Accept the shared prop while deriving Android's scroll range from the drawn text.
      Prop("contentWidth") { _: KairoReviewDiffView, _: Double -> }
      Prop("contentInsetBottom") { view: KairoReviewDiffView, value: Double ->
        view.setContentInsetBottom(value.toFloat())
      }
      Prop("scrollEnabled") { view: KairoReviewDiffView, enabled: Boolean ->
        view.setScrollEnabled(enabled)
      }
      Prop("initialRowIndex") { view: KairoReviewDiffView, initialRowIndex: Double ->
        view.setInitialRowIndex(initialRowIndex)
      }
      Prop("initialFileId") { view: KairoReviewDiffView, fileId: String ->
        view.setInitialFileId(fileId)
      }

      Events(REVIEW_DIFF_EVENTS)

      AsyncFunction("scrollToFile") { view: KairoReviewDiffView, fileId: String, animated: Boolean ->
        view.scrollToFile(fileId, animated)
      }
      AsyncFunction("scrollToTop") { view: KairoReviewDiffView, animated: Boolean ->
        view.scrollToTop(animated)
      }
      AsyncFunction("setRowsJson") { view: KairoReviewDiffView, rowsJson: String, resetKey: String ->
        view.setContentResetKey(resetKey)
        view.setRowsJson(rowsJson)
      }
      AsyncFunction("setTokensJson") { view: KairoReviewDiffView, tokensJson: String ->
        view.setTokensJson(tokensJson)
      }
      AsyncFunction("setTokensPatchJson") {
          view: KairoReviewDiffView,
          tokensPatchJson: String,
          promise: Promise
        ->
        view.setTokensPatchJson(tokensPatchJson) { accepted -> promise.resolve(accepted) }
      }

      OnViewDestroys { view: KairoReviewDiffView ->
        view.cleanup()
      }
    }
  }
}
