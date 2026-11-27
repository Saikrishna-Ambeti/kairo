#pragma once

#include <react/renderer/components/KairoSourceTextSpec/EventEmitters.h>
#include <react/renderer/components/KairoSourceTextSpec/Props.h>
#include <react/renderer/components/KairoSourceTextSpec/States.h>
#include <react/renderer/components/view/ConcreteViewShadowNode.h>

namespace facebook::react {
extern const char KairoSourceTextRunComponentName[];

using KairoSourceTextRunShadowNode =
    ConcreteViewShadowNode<KairoSourceTextRunComponentName, KairoSourceTextRunProps,
                           KairoSourceTextRunEventEmitter, KairoSourceTextRunState>;
} // namespace facebook::react
