import type { ArtifactKind, EnvironmentId } from "@kairo/contracts";
import {
  ARTIFACT_CREATION_COMMANDS,
  isArtifactCreationKind,
} from "@kairo/client-runtime/artifact-creation";
import { EnvironmentId as EnvironmentIdSchema } from "@kairo/contracts";
import type { MenuAction } from "@react-native-menu/menu";
import { useNavigation, type StaticScreenProps } from "@react-navigation/native";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  View,
} from "react-native";

import { AndroidScreenHeader } from "../../components/AndroidScreenHeader";
import { AppText as Text, AppTextInput as TextInput } from "../../components/AppText";
import { ControlPillMenu } from "../../components/ControlPill";
import { NativeStackScreenOptions } from "../../native/StackHeader";
import { useEnvironments } from "../../state/environments";
import { useEnvironmentQuery } from "../../state/query";
import { serverEnvironment } from "../../state/server";
import { MobileArtifactRow } from "./ThreadArtifactsList";

const FILTERS: ReadonlyArray<{ readonly label: string; readonly kind: ArtifactKind | null }> = [
  { label: "All", kind: null },
  { label: "Docs", kind: "document" },
  { label: "Slides", kind: "presentation" },
  { label: "Sheets", kind: "spreadsheet" },
  { label: "CSV", kind: "csv" },
  { label: "PDF", kind: "pdf" },
];

export function ArtifactLibraryScreen(
  props: StaticScreenProps<{ readonly environmentId?: string }>,
) {
  const { environments } = useEnvironments();
  const navigation = useNavigation();
  const [environmentOverride, setEnvironmentOverride] = useState<EnvironmentId | null>(null);
  const [search, setSearch] = useState("");
  const [queryText, setQueryText] = useState("");
  const [kind, setKind] = useState<ArtifactKind | null>(null);
  const routeEnvironment = props.route.params?.environmentId;
  const environmentId =
    environmentOverride ??
    (routeEnvironment && environments.some((item) => item.environmentId === routeEnvironment)
      ? EnvironmentIdSchema.make(routeEnvironment)
      : (environments[0]?.environmentId ?? null));
  const environmentLabel = environments.find((item) => item.environmentId === environmentId)?.label;

  useEffect(() => {
    const timer = setTimeout(() => setQueryText(search.trim()), 200);
    return () => clearTimeout(timer);
  }, [search]);

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
  const environmentActions = useMemo<MenuAction[]>(
    () =>
      environments.map((item) => ({
        id: String(item.environmentId),
        title: item.label,
        state: item.environmentId === environmentId ? "on" : undefined,
      })),
    [environmentId, environments],
  );
  const artifacts = artifactsQuery.data?.artifacts ?? [];

  return (
    <View className="flex-1 bg-sheet">
      <NativeStackScreenOptions
        options={{ title: "Library", headerShown: Platform.OS === "ios" }}
      />
      {Platform.OS === "android" ? <AndroidScreenHeader title="Library" /> : null}
      <View className="gap-3 border-b border-border px-4 py-3">
        <ControlPillMenu
          actions={ARTIFACT_CREATION_COMMANDS.map(({ kind, label }) => ({
            id: kind,
            title: `Create ${label}`,
          }))}
          onPressAction={({ nativeEvent }) => {
            if (!isArtifactCreationKind(nativeEvent.event)) return;
            navigation.navigate("NewTaskSheet", {
              screen: "NewTask",
              params: {
                artifactKind: nativeEvent.event,
                environmentId: environmentId ?? undefined,
              },
            });
          }}
        >
          <Pressable accessibilityRole="button" accessibilityLabel="Create file">
            <Text className="text-sm font-kairo-medium text-accent">Create file ▾</Text>
          </Pressable>
        </ControlPillMenu>
        {environments.length > 1 ? (
          <ControlPillMenu
            actions={environmentActions}
            onPressAction={({ nativeEvent }) => {
              const selected = environments.find(
                (item) => item.environmentId === nativeEvent.event,
              );
              if (selected) setEnvironmentOverride(selected.environmentId);
            }}
          >
            <Pressable accessibilityRole="button" accessibilityLabel="Choose environment">
              <Text className="text-sm font-kairo-medium text-accent">
                {environmentLabel ?? "Choose environment"} ▾
              </Text>
            </Pressable>
          </ControlPillMenu>
        ) : null}
        <TextInput
          accessibilityLabel="Search library"
          autoCapitalize="none"
          autoCorrect={false}
          className="min-h-11 rounded-xl border border-input-border bg-input px-3 text-sm"
          placeholder="Search files, projects, and threads"
          value={search}
          onChangeText={setSearch}
        />
        <View className="flex-row flex-wrap gap-2">
          {FILTERS.map((filter) => (
            <Pressable
              key={filter.label}
              accessibilityRole="button"
              accessibilityState={{ selected: kind === filter.kind }}
              className={`rounded-full px-3 py-1.5 ${kind === filter.kind ? "bg-subtle-strong" : "bg-subtle"}`}
              onPress={() => setKind(filter.kind)}
            >
              <Text className="text-xs font-kairo-medium text-foreground">{filter.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <FlatList
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
                    ? "Connect an environment to see its files."
                    : queryText || kind
                      ? "No matching files."
                      : "Files created by agents will appear here.")}
              </Text>
            )}
          </View>
        }
      />
    </View>
  );
}
