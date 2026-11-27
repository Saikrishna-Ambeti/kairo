import { LegendList } from "@legendapp/list/react-native";
import { msg, useGT, useMessages } from "gt-react-native";
import type { ArtifactKind, EnvironmentId } from "@kairo/contracts";
import {
  ARTIFACT_CREATION_COMMANDS,
  isArtifactCreationKind,
} from "@kairo/client-runtime/artifact-creation";
import { EnvironmentId as EnvironmentIdSchema } from "@kairo/contracts";
import { MenuView, type MenuAction } from "@react-native-menu/menu";
import { useNavigation, type StaticScreenProps } from "@react-navigation/native";
import { useState } from "react";
import { ActivityIndicator, Platform, Pressable, View } from "react-native";

import { AppText as Text, AppTextInput as TextInput } from "../../components/ui/AppText";
import { NativeScrollView } from "../../native/NativeScrollViewMarker";
import { RefreshControl } from "../../components/ui/RefreshControl";
import { useDebouncedValue } from "../../state/queries";
import { NativeStackScreenOptions } from "../../native/StackHeader";
import { useEnvironments } from "../../state/environments";
import { useEnvironmentQuery } from "../../state/query";
import { serverEnvironment } from "../../state/server";
import { MobileArtifactRow } from "./ThreadArtifactsList";

const FILTERS: ReadonlyArray<{ readonly label: string; readonly kind: ArtifactKind | null }> = [
  { label: msg("All"), kind: null },
  { label: msg("Docs"), kind: "document" },
  { label: msg("Slides"), kind: "presentation" },
  { label: msg("Sheets"), kind: "spreadsheet" },
  { label: msg("CSV"), kind: "csv" },
  { label: msg("PDF"), kind: "pdf" },
];

export function ArtifactLibraryScreen(
  props: StaticScreenProps<{ readonly environmentId?: string }>,
) {
  const gt = useGT();
  const m = useMessages();
  const { environments } = useEnvironments();
  const navigation = useNavigation();
  const [environmentOverride, setEnvironmentOverride] = useState<EnvironmentId | null>(null);
  const [search, setSearch] = useState("");
  const queryText = useDebouncedValue(search.trim(), 200);
  const [kind, setKind] = useState<ArtifactKind | null>(null);
  const routeEnvironment = props.route.params?.environmentId;
  const environmentId =
    environmentOverride ??
    (routeEnvironment && environments.some((item) => item.environmentId === routeEnvironment)
      ? EnvironmentIdSchema.make(routeEnvironment)
      : (environments[0]?.environmentId ?? null));
  const environmentLabel = environments.find((item) => item.environmentId === environmentId)?.label;

  const artifactsQuery = useEnvironmentQuery(
    environmentId === null
      ? null
      : serverEnvironment.artifacts({
          environmentId,
          input: {
            ...(queryText ? { query: queryText } : {}),
            ...(kind ? { kinds: [kind] } : {}),
            limit: 500,
          },
        }),
  );
  const environmentActions = environments.map<MenuAction>((item) => ({
    id: String(item.environmentId),
    title: item.label,
    state: item.environmentId === environmentId ? "on" : undefined,
  }));
  const artifacts = artifactsQuery.data?.artifacts ?? [];

  return (
    <View className="flex-1 bg-sheet">
      <NativeStackScreenOptions
        options={{ title: gt("Library"), headerShown: Platform.OS === "ios" }}
      />
      <View className="gap-3 border-b border-border px-4 py-3">
        <MenuView
          actions={ARTIFACT_CREATION_COMMANDS.map(({ kind, creationTitle }) => ({
            id: kind,
            title: m(creationTitle),
          }))}
          onPressAction={({ nativeEvent }) => {
            if (!isArtifactCreationKind(nativeEvent.event)) return;
            navigation.navigate("NewTaskProject", { artifactKind: nativeEvent.event });
          }}
        >
          <Pressable accessibilityRole="button" accessibilityLabel={gt("Create file")}>
            <Text className="text-sm font-kairo-medium text-accent">{gt("Create file")} ▾</Text>
          </Pressable>
        </MenuView>
        {environments.length > 1 ? (
          <MenuView
            actions={environmentActions}
            onPressAction={({ nativeEvent }) => {
              const selected = environments.find(
                (item) => item.environmentId === nativeEvent.event,
              );
              if (selected) setEnvironmentOverride(selected.environmentId);
            }}
          >
            <Pressable accessibilityRole="button" accessibilityLabel={gt("Choose environment")}>
              <Text className="text-sm font-kairo-medium text-accent">
                {environmentLabel ?? gt("Choose environment")} ▾
              </Text>
            </Pressable>
          </MenuView>
        ) : null}
        <TextInput
          accessibilityLabel={gt("Search library")}
          autoCapitalize="none"
          autoCorrect={false}
          className="min-h-11 rounded-xl border border-input-border bg-input px-3 text-sm"
          placeholder={gt("Search files, projects, and threads")}
          value={search}
          onChangeText={setSearch}
        />
        <View className="flex-row flex-wrap gap-2">
          {FILTERS.map((filter) => (
            <Pressable
              key={filter.kind ?? "all"}
              accessibilityRole="button"
              accessibilityState={{ selected: kind === filter.kind }}
              className={`rounded-full px-3 py-1.5 ${kind === filter.kind ? "bg-subtle-strong" : "bg-subtle"}`}
              onPress={() => setKind(filter.kind)}
            >
              <Text className="text-xs font-kairo-medium text-foreground">{m(filter.label)}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <LegendList
        renderScrollComponent={NativeScrollView}
        estimatedItemSize={52}
        extraData={environmentId}
        className="flex-1"
        data={artifacts}
        keyExtractor={(artifact) => `${artifact.threadId}:${artifact.relativePath}`}
        renderItem={({ item }) =>
          environmentId === null ? null : (
            <MobileArtifactRow artifact={item} environmentId={environmentId} />
          )
        }
        contentContainerStyle={{ paddingVertical: 8 }}
        refreshControl={
          <RefreshControl
            refreshing={artifactsQuery.isPending}
            onRefresh={artifactsQuery.refresh}
          />
        }
        ListEmptyComponent={
          <View className="items-center px-6 py-12">
            {artifactsQuery.isPending ? (
              <ActivityIndicator />
            ) : (
              <Text className="text-center text-sm text-foreground-muted">
                {artifactsQuery.error ??
                  (environmentId === null
                    ? gt("Connect an environment to see its files.")
                    : queryText || kind
                      ? gt("No matching files.")
                      : gt("Files created by agents will appear here."))}
              </Text>
            )}
          </View>
        }
      />
    </View>
  );
}
