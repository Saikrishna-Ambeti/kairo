#pragma once

#include "KairoMarkdownTextRunShadowNode.h"

#include <react/renderer/core/ConcreteComponentDescriptor.h>
#include <react/renderer/componentregistry/ComponentDescriptorProviderRegistry.h>

namespace facebook::react {
using KairoMarkdownTextRunComponentDescriptor = ConcreteComponentDescriptor<KairoMarkdownTextRunShadowNode>;

void KairoMarkdownTextRunSpec_registerComponentDescriptorsFromCodegen(
  std::shared_ptr<const ComponentDescriptorProviderRegistry> registry);
}
