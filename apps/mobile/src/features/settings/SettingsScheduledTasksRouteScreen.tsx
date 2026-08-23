import { useNavigation } from "@react-navigation/native";
import { Platform, View } from "react-native";

import { AndroidScreenHeader } from "../../components/AndroidScreenHeader";
import { AppText as Text } from "../../components/AppText";
import { SymbolView } from "../../components/AppSymbol";
import { NativeStackScreenOptions } from "../../native/StackHeader";

export function SettingsScheduledTasksRouteScreen() {
  const navigation = useNavigation();

  return (
    <View className="flex-1 bg-sheet">
      {Platform.OS === "android" ? (
        <>
          <NativeStackScreenOptions options={{ headerShown: false }} />
          <AndroidScreenHeader title="Scheduled tasks" onBack={() => navigation.goBack()} />
        </>
      ) : null}
      <View className="flex-1 items-center justify-center gap-3 px-8">
        <SymbolView name="clock" size={30} type="monochrome" />
        <Text className="text-center text-xl font-kairo-medium text-foreground">
          Manage schedules on web or desktop
        </Text>
        <Text className="max-w-[340px] text-center text-base leading-6 text-foreground-muted">
          Mobile schedule editing is not supported yet. Scheduled runs still execute on your Kairo
          environment, and their chats remain available here.
        </Text>
      </View>
    </View>
  );
}
