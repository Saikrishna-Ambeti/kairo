import { T, useGT } from "gt-react-native";
import { useDebouncedValue } from "../../state/queries";
import type { ArtifactMetadata, EnvironmentId, ThreadId } from "@kairo/contracts";
import { prependArtifactRevisionPrompt } from "@kairo/client-runtime/artifact-creation";
import { StackActions, useNavigation } from "@react-navigation/native";
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { Alert, Pressable, View } from "react-native";

import { AppText as Text } from "../../components/ui/AppText";
import { SymbolView } from "../../components/ui/AppSymbol";
import { downloadAndShareAttachment } from "../../lib/attachmentDownload";
import { useRefreshAssetUrl } from "../../state/assets";
import { useEnvironmentQuery } from "../../state/query";
import { serverEnvironment } from "../../state/server";
import { scopedThreadKey } from "../../lib/scopedEntities";
import {
  getComposerDraftSnapshot,
  setComposerDraftText,
  updateComposerDraftSettings,
  waitForComposerDraftsLoaded,
} from "../../state/use-composer-drafts";

const ARTIFACT_MIME_TYPES: Record<ArtifactMetadata["kind"], string> = {
  document: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  presentation: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  spreadsheet: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  pdf: "application/pdf",
};

export function MobileArtifactRow(props: {
  readonly artifact: ArtifactMetadata;
  readonly environmentId: EnvironmentId;
}) {
  const gt = useGT();
  const [isSharing, setIsSharing] = useState(false);
  const navigation = useNavigation();
  const controllerRef = useRef<AbortController | null>(null);
  const resource = useMemo(
    () => ({
      _tag: "workspace-document" as const,
      threadId: props.artifact.threadId,
      path: props.artifact.relativePath,
    }),
    [props.artifact.relativePath, props.artifact.threadId],
  );
  const refreshUrl = useRefreshAssetUrl(props.environmentId, resource);
  // oxlint-disable-next-line kairo/no-unreasoned-state-sync -- Aborts an in-flight share when the row unmounts.
  useEffect(() => () => controllerRef.current?.abort(), []);

  const share = useCallback(async () => {
    if (isSharing) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    setIsSharing(true);
    try {
      const url = await refreshUrl();
      if (controller.signal.aborted) return;
      if (url === null) throw new Error(gt("File unavailable. Refresh and try again."));
      await downloadAndShareAttachment({
        url,
        attachment: {
          name: props.artifact.fileName,
          mimeType: ARTIFACT_MIME_TYPES[props.artifact.kind],
        },
        signal: controller.signal,
      });
    } catch (error) {
      if (!controller.signal.aborted) {
        Alert.alert(
          gt("Could not open file"),
          error instanceof Error ? error.message : gt("Try again."),
        );
      }
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
      if (!controller.signal.aborted) setIsSharing(false);
    }
  }, [gt, isSharing, props.artifact.fileName, props.artifact.kind, refreshUrl]);

  return (
    <View className="mx-2 flex-row items-center rounded-xl">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={gt("Open {fileName}", { fileName: props.artifact.fileName })}
        className="min-h-[48px] min-w-0 flex-1 flex-row items-center gap-3 rounded-xl px-2 active:bg-subtle"
        disabled={isSharing}
        onPress={() => void share()}
      >
        <SymbolView
          name={
            props.artifact.kind === "presentation"
              ? "rectangle.on.rectangle"
              : props.artifact.kind === "spreadsheet" || props.artifact.kind === "csv"
                ? "tablecells"
                : "doc.text"
          }
          size={19}
          tintColorClassName="accent-icon"
          type="monochrome"
        />
        <View className="min-w-0 flex-1">
          <Text className="text-sm font-kairo-medium text-foreground" numberOfLines={1}>
            {props.artifact.title}
          </Text>
          <Text className="text-xs text-foreground-muted" numberOfLines={1}>
            {props.artifact.fileName}
          </Text>
        </View>
        <Text className="text-xs text-foreground-muted">
          {isSharing ? gt("Opening") : gt("Open")}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={gt("Revise {fileName}", { fileName: props.artifact.fileName })}
        className="min-h-[44px] justify-center rounded-xl px-2 active:bg-subtle"
        onPress={() =>
          void (async () => {
            await waitForComposerDraftsLoaded();
            const draftKey = scopedThreadKey(props.environmentId, props.artifact.threadId);
            setComposerDraftText(
              draftKey,
              prependArtifactRevisionPrompt(
                props.artifact.relativePath,
                getComposerDraftSnapshot(draftKey).text,
              ),
            );
            updateComposerDraftSettings(draftKey, { interactionMode: "default" });
            navigation.dispatch(
              StackActions.push("Thread", {
                environmentId: String(props.environmentId),
                threadId: String(props.artifact.threadId),
              }),
            );
          })().catch((error: unknown) => {
            Alert.alert(
              gt("Could not prepare revision"),
              error instanceof Error ? error.message : gt("Try again."),
            );
          })
        }
      >
        <Text className="text-xs font-kairo-medium text-accent">
          <T>Revise</T>
        </Text>
      </Pressable>
    </View>
  );
}

export function ThreadArtifactsList(props: {
  readonly environmentId: EnvironmentId;
  readonly threadId: ThreadId;
  readonly searchQuery: string;
  readonly refreshToken?: number;
}) {
  const gt = useGT();
  const queryText = useDebouncedValue(props.searchQuery.trim(), 200);
  const [pageState, setPageState] = useState({ key: "", page: 0 });
  const query = useEnvironmentQuery(
    serverEnvironment.artifacts({
      environmentId: props.environmentId,
      input: {
        threadId: props.threadId,
        ...(queryText ? { query: queryText } : {}),
        limit: 500,
      },
    }),
  );
  const refreshArtifacts = useEffectEvent(query.refresh);
  // oxlint-disable-next-line kairo/no-unreasoned-state-sync -- Refreshes the external artifact index after the composer reports a change.
  useEffect(() => {
    if (props.refreshToken !== undefined && props.refreshToken > 0) refreshArtifacts();
  }, [props.refreshToken]);
  const pageKey = JSON.stringify([props.environmentId, props.threadId, queryText]);
  if (pageState.key !== pageKey) setPageState({ key: pageKey, page: 0 });
  const artifacts = query.data?.artifacts;
  if (!artifacts?.length) return null;
  const page = pageState.key === pageKey ? pageState.page : 0;
  const pageCount = Math.ceil(artifacts.length / 20);
  const currentPage = Math.min(page, pageCount - 1);
  const firstIndex = currentPage * 20;

  return (
    <View className="border-b border-border pb-2 pt-2">
      <View className="mb-1 flex-row items-center justify-between px-4">
        <Text className="text-2xs font-kairo-bold uppercase tracking-wide text-foreground-muted">
          <T>Artifacts</T>
        </Text>
        <Text className="text-2xs text-foreground-muted">{artifacts.length}</Text>
      </View>
      {artifacts.slice(firstIndex, firstIndex + 20).map((artifact) => (
        <MobileArtifactRow
          key={`${artifact.threadId}:${artifact.relativePath}`}
          artifact={artifact}
          environmentId={props.environmentId}
        />
      ))}
      {pageCount > 1 ? (
        <View className="flex-row items-center justify-between px-4">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={gt("Previous artifact page")}
            className="min-h-[44px] justify-center rounded-xl px-2 active:bg-subtle disabled:opacity-40"
            disabled={currentPage === 0}
            onPress={() => setPageState({ key: pageKey, page: currentPage - 1 })}
          >
            <Text className="text-xs font-kairo-medium text-accent">
              <T>Previous</T>
            </Text>
          </Pressable>
          <Text className="text-xs text-foreground-muted">
            {gt("{start}-{end} of {total}", {
              start: firstIndex + 1,
              end: Math.min(firstIndex + 20, artifacts.length),
              total: artifacts.length,
            })}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={gt("Next artifact page")}
            className="min-h-[44px] justify-center rounded-xl px-2 active:bg-subtle disabled:opacity-40"
            disabled={currentPage === pageCount - 1}
            onPress={() => setPageState({ key: pageKey, page: currentPage + 1 })}
          >
            <Text className="text-xs font-kairo-medium text-accent">
              <T>Next</T>
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
