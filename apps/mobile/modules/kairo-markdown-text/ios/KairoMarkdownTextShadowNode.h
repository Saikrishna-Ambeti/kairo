#pragma once

#include <react/renderer/components/KairoMarkdownTextSpec/EventEmitters.h>
#include <react/renderer/components/KairoMarkdownTextSpec/Props.h>
#include <react/renderer/components/view/ConcreteViewShadowNode.h>
#include <react/renderer/textlayoutmanager/TextLayoutManager.h>
#include <react/renderer/core/LayoutContext.h>
#include <react/renderer/core/ShadowNode.h>

#include <string>
#include <vector>

namespace facebook::react {

extern const char KairoMarkdownTextComponentName[];

struct KairoMarkdownTextParagraphStyleRange {
  size_t location;
  size_t length;
  Float firstLineHeadIndent;
  Float headIndent;
  Float paragraphSpacing;
};

struct KairoMarkdownTextAttachmentRange {
  size_t location;
  size_t length;
  std::string imageUri;
};

inline Float KairoMarkdownTextAttachmentSize(const KairoMarkdownTextAttachmentRange &) {
  return 14;
}

inline Float KairoMarkdownTextAttachmentBaselineOffset(
    const KairoMarkdownTextAttachmentRange &) {
  return -2;
}

class KairoMarkdownTextStateReal final {
 public:
  AttributedString attributedString;
  std::vector<KairoMarkdownTextParagraphStyleRange> paragraphStyleRanges;
  std::vector<KairoMarkdownTextAttachmentRange> attachmentRanges;
};

class KairoMarkdownTextShadowNode final : public ConcreteViewShadowNode<
KairoMarkdownTextComponentName,
KairoMarkdownTextProps,
KairoMarkdownTextEventEmitter,
KairoMarkdownTextStateReal> {
public:
  using ConcreteViewShadowNode::ConcreteViewShadowNode;

  KairoMarkdownTextShadowNode(
   const ShadowNode& sourceShadowNode,
   const ShadowNodeFragment& fragment
  );

  static ShadowNodeTraits BaseTraits() {
    auto traits = ConcreteViewShadowNode::BaseTraits();
    traits.set(ShadowNodeTraits::Trait::LeafYogaNode);
    traits.set(ShadowNodeTraits::Trait::MeasurableYogaNode);
    return traits;
  }

  void layout(LayoutContext layoutContext) override;

  Size measureContent(
      const LayoutContext& layoutContext,
      const LayoutConstraints& layoutConstraints) const override;

private:
  mutable AttributedString _attributedString;
  mutable std::vector<KairoMarkdownTextParagraphStyleRange> _paragraphStyleRanges;
  mutable std::vector<KairoMarkdownTextAttachmentRange> _attachmentRanges;
};
} // namespace facebook::React
