#pragma once

#include "KairoSourceTextRunShadowNode.h"

#include <react/renderer/componentregistry/ComponentDescriptorProviderRegistry.h>
#include <react/renderer/core/ConcreteComponentDescriptor.h>

namespace facebook::react {
using KairoSourceTextRunComponentDescriptor =
    ConcreteComponentDescriptor<KairoSourceTextRunShadowNode>;

void KairoSourceTextRunSpec_registerComponentDescriptorsFromCodegen(
    std::shared_ptr<const ComponentDescriptorProviderRegistry> registry);
} // namespace facebook::react
