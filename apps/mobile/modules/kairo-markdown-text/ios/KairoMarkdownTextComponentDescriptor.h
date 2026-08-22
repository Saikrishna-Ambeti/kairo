#pragma once

#include "KairoMarkdownTextShadowNode.h"

#include <react/renderer/core/ConcreteComponentDescriptor.h>
#include <react/renderer/componentregistry/ComponentDescriptorProviderRegistry.h>

namespace facebook::react {
using KairoMarkdownTextComponentDescriptor = ConcreteComponentDescriptor<KairoMarkdownTextShadowNode>;

void KairoMarkdownTextSpec_registerComponentDescriptorsFromCodegen(
  std::shared_ptr<const ComponentDescriptorProviderRegistry> registry);
}
