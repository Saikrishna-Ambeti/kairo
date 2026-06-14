import { Link } from "@tanstack/react-router";
import type {
  ComposioOperationProgressEvent,
  ComposioStatus,
  ComposioToolkitCatalog,
  ComposioToolkitCatalogItem,
} from "@kairo/contracts";
import {
  ArrowLeftIcon,
  ExternalLinkIcon,
  LoaderCircleIcon,
  PlugZapIcon,
  SearchIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ensureLocalApi } from "../../localApi";
import { Alert, AlertDescription } from "../ui/alert";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { stackedThreadToast, toastManager } from "../ui/toast";
import { ComposioSetupDialog } from "./IntegrationsSettings";
import { getAvailableComposioCatalogItems } from "./IntegrationsSettings.logic";
import { SettingsPageContainer, SettingsSection } from "./settingsLayout";

function showComposioError(title: string, error: unknown) {
  toastManager.add(
    stackedThreadToast({
      type: "error",
      title,
      description: error instanceof Error ? error.message : String(error),
    }),
  );
}

function AppRow({
  item,
  disabled,
  connecting,
  onConnect,
}: {
  item: ComposioToolkitCatalogItem;
  disabled: boolean;
  connecting: boolean;
  onConnect: (toolkit: string) => void;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-t border-border/60 px-4 py-3.5 first:border-t-0 sm:px-5">
      <div className="min-w-0 space-y-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {item.logoUrl ? (
            <img src={item.logoUrl} alt="" className="size-5 rounded-sm object-contain" />
          ) : null}
          <span className="truncate text-sm font-semibold">{item.label}</span>
          <Badge size="sm" variant="outline">
            {item.toolkit}
          </Badge>
          {item.category ? (
            <Badge size="sm" variant="secondary">
              {item.category}
            </Badge>
          ) : null}
        </div>
        <p className="line-clamp-2 text-xs text-muted-foreground/80">
          {item.description ?? "Connect this app through Composio."}
        </p>
        {item.toolsCount || item.triggersCount ? (
          <p className="text-[11px] text-muted-foreground">
            {[
              item.toolsCount ? `${item.toolsCount} tools` : null,
              item.triggersCount ? `${item.triggersCount} triggers` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        ) : null}
      </div>
      <div className="flex items-start gap-2">
        {item.appUrl ? (
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Open ${item.label}`}
            onClick={() => void ensureLocalApi().shell.openExternal(item.appUrl!)}
          >
            <ExternalLinkIcon className="size-4" />
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="outline"
          disabled={disabled || connecting}
          onClick={() => onConnect(item.toolkit)}
        >
          {connecting ? (
            <LoaderCircleIcon className="size-3.5 animate-spin" />
          ) : (
            <PlugZapIcon className="size-3.5" />
          )}
          Connect
        </Button>
      </div>
    </div>
  );
}

export function ComposioAppsSettings() {
  const [query, setQuery] = useState("");
  const [catalog, setCatalog] = useState<ComposioToolkitCatalog | null>(null);
  const [status, setStatus] = useState<ComposioStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectingToolkit, setConnectingToolkit] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [events, setEvents] = useState<ComposioOperationProgressEvent[]>([]);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const backgroundStatusRefreshStartedRef = useRef(false);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    try {
      const localApi = ensureLocalApi();
      const [nextCatalog, nextStatus] = await Promise.all([
        localApi.server.listComposioToolkits({
          limit: 1000,
        }),
        localApi.server.getComposioStatus(),
      ]);
      setCatalog(nextCatalog);
      setStatus(nextStatus);
    } catch (error) {
      showComposioError("Could not load Composio apps", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    if (!catalog || backgroundStatusRefreshStartedRef.current) return;
    backgroundStatusRefreshStartedRef.current = true;
    const timeoutIds = [1_500, 4_000, 8_000].map((delay) =>
      window.setTimeout(() => {
        void ensureLocalApi()
          .server.getComposioStatus()
          .then(setStatus)
          .catch(() => undefined);
      }, delay),
    );
    return () => {
      for (const id of timeoutIds) window.clearTimeout(id);
    };
  }, [catalog]);

  const items = useMemo(
    () => getAvailableComposioCatalogItems(catalog?.items ?? [], status, query),
    [catalog?.items, query, status],
  );

  const appendProgress = (event: ComposioOperationProgressEvent) => {
    setEvents((previous) => [...previous, event].slice(-80));
    if (event.authUrl) setAuthUrl(event.authUrl);
  };

  const connectToolkit = async (toolkit: string) => {
    setConnectingToolkit(toolkit);
    setEvents([]);
    setAuthUrl(null);
    setDialogOpen(true);
    try {
      await ensureLocalApi().server.linkComposioToolkit({ toolkit }, appendProgress);
      setStatus(await ensureLocalApi().server.getComposioStatus());
      toastManager.add(stackedThreadToast({ type: "success", title: `${toolkit} connected` }));
    } catch (error) {
      showComposioError(`Could not connect ${toolkit}`, error);
    } finally {
      setConnectingToolkit(null);
    }
  };

  return (
    <SettingsPageContainer>
      <SettingsSection icon={<PlugZapIcon className="size-3.5" />} title="Composio apps">
        <div className="space-y-4 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="ghost" render={<Link to="/settings/integrations" />}>
              <ArrowLeftIcon className="size-4" />
              Integrations
            </Button>
            <div className="relative w-full sm:max-w-md">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.currentTarget.value)}
                placeholder="Search apps"
                className="pl-9"
              />
            </div>
          </div>
          {catalog?.message ? (
            <Alert>
              <AlertDescription>{catalog.message}</AlertDescription>
            </Alert>
          ) : null}
        </div>
      </SettingsSection>

      <SettingsSection title={loading ? "Loading apps" : `${items.length} apps`}>
        {loading ? (
          <div className="flex items-center gap-2 px-5 py-5 text-sm text-muted-foreground">
            <LoaderCircleIcon className="size-4 animate-spin" />
            Loading Composio apps...
          </div>
        ) : items.length === 0 ? (
          <div className="px-5 py-5 text-sm text-muted-foreground">No apps found.</div>
        ) : (
          items.map((item) => (
            <AppRow
              key={item.toolkit}
              item={item}
              disabled={Boolean(connectingToolkit)}
              connecting={connectingToolkit === item.toolkit}
              onConnect={connectToolkit}
            />
          ))
        )}
      </SettingsSection>

      <ComposioSetupDialog
        open={dialogOpen}
        mode="login"
        events={events}
        authUrl={authUrl}
        onOpenChange={setDialogOpen}
      />
    </SettingsPageContainer>
  );
}
