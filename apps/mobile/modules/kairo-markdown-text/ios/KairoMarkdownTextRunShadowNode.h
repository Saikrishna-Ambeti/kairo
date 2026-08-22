#pragma once

#include <react/renderer/components/KairoMarkdownTextSpec/EventEmitters.h>
#include <react/renderer/components/KairoMarkdownTextSpec/Props.h>
#include <react/renderer/components/KairoMarkdownTextSpec/States.h>
#include <react/renderer/components/view/ConcreteViewShadowNode.h>

namespace facebook::react {
extern const char KairoMarkdownTextRunComponentName[];

using KairoMarkdownTextRunShadowNode = ConcreteViewShadowNode<
    KairoMarkdownTextRunComponentName,
    KairoMarkdownTextRunProps,
    KairoMarkdownTextRunEventEmitter,
    KairoMarkdownTextRunState>;
}
