package expo.modules.kairosubscriptionwidget

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject

class KairoSubscriptionWidgetModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("KairoSubscriptionWidget")
    Function("updateSnapshot") { snapshot: String ->
      val context = appContext.reactContext ?: return@Function
      JSONObject(snapshot) // Reject malformed writes before replacing the saved snapshot.
      context.getSharedPreferences(SubscriptionUsageWidget.PREFERENCES, 0)
        .edit().putString("snapshot", snapshot).apply()
      SubscriptionUsageWidget.updateAll(context)
    }
  }
}
