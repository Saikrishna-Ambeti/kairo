package expo.modules.t3agentnotifications

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class KairoAgentNotificationsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("KairoAgentNotifications")

    Function("configure") {
        deviceId: String,
        userId: String,
        scheme: String,
        ongoingEnabled: Boolean
      ->
      appContext.reactContext?.let {
        AgentNotifications.configure(it, deviceId, userId, scheme, ongoingEnabled)
      }
    }

    Function("clear") {
      appContext.reactContext?.let { AgentNotifications.clear(it) }
    }
  }
}
