package expo.modules.kairowidgetexpiry

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class KairoWidgetExpiryModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("KairoWidgetExpiry")
    Function("schedule") { name: String, deadlines: List<Double> ->
      val context = appContext.reactContext ?: return@Function
      WidgetExpiryReceiver.schedule(context, name, deadlines.map { it.toLong() }.toLongArray())
    }
  }
}
