import {
  type ModelSelection,
  type OrchestrationProjectShell,
  type ProviderOptionDescriptor,
  type ServerProvider,
  isProviderAvailable,
} from "@kairo/contracts";
import {
  buildProviderOptionSelectionsFromDescriptors,
  createModelSelection,
  getProviderOptionDescriptors,
} from "@kairo/shared/model";

import { getProviderModelCapabilities } from "../../providerModels";

const REASONING_OPTION_IDS = new Set(["reasoningEffort", "effort", "reasoning", "variant"]);

export function isScheduledTaskProviderAvailable(provider: ServerProvider): boolean {
  return (
    provider.enabled &&
    provider.installed &&
    isProviderAvailable(provider) &&
    provider.models.length > 0
  );
}

export function modelSelectionForProvider(
  provider: ServerProvider,
  requestedModel?: string,
  selections?: ModelSelection["options"],
): ModelSelection | null {
  const model =
    provider.models.find((candidate) => candidate.slug === requestedModel) ??
    provider.models.find((candidate) => candidate.isDefault) ??
    provider.models[0];
  if (!model) return null;

  const descriptors = getProviderOptionDescriptors({
    caps: getProviderModelCapabilities(provider.models, model.slug, provider.driver),
    selections,
  });
  return createModelSelection(
    provider.instanceId,
    model.slug,
    buildProviderOptionSelectionsFromDescriptors(descriptors),
  );
}

export function modelSelectionForProject(
  project: OrchestrationProjectShell | undefined,
  providers: ReadonlyArray<ServerProvider>,
): ModelSelection | null {
  const projectDefault = project?.defaultModelSelection;
  if (projectDefault) {
    const provider = providers.find(
      (candidate) =>
        candidate.instanceId === projectDefault.instanceId &&
        isScheduledTaskProviderAvailable(candidate),
    );
    if (provider) {
      const selection = modelSelectionForProvider(
        provider,
        projectDefault.model,
        projectDefault.options,
      );
      if (selection) return selection;
    }
  }

  const provider = providers.find(isScheduledTaskProviderAvailable);
  return provider ? modelSelectionForProvider(provider) : null;
}

export function reasoningDescriptorForSelection(
  provider: ServerProvider | undefined,
  selection: ModelSelection | null,
): Extract<ProviderOptionDescriptor, { type: "select" }> | null {
  if (!provider || !selection) return null;
  const descriptors = getProviderOptionDescriptors({
    caps: getProviderModelCapabilities(provider.models, selection.model, provider.driver),
    selections: selection.options,
  });
  const descriptor = descriptors.find(
    (candidate): candidate is Extract<ProviderOptionDescriptor, { type: "select" }> =>
      candidate.type === "select" && REASONING_OPTION_IDS.has(candidate.id),
  );
  if (!descriptor) return null;

  const options = descriptor.options.filter(
    (option) => !descriptor.promptInjectedValues?.includes(option.id),
  );
  return options.length > 0 ? { ...descriptor, options } : null;
}

export function withReasoningSelection(
  selection: ModelSelection,
  descriptorId: string,
  value: string,
): ModelSelection {
  const options = (selection.options ?? []).filter((option) => option.id !== descriptorId);
  return createModelSelection(selection.instanceId, selection.model, [
    ...options,
    { id: descriptorId, value },
  ]);
}
