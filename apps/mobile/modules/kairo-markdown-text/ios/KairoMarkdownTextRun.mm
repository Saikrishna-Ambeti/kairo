#import "KairoMarkdownTextRun.h"
#import "KairoMarkdownText.h"
#import "KairoMarkdownTextRunComponentDescriptor.h"
#import <react/renderer/components/KairoMarkdownTextSpec/EventEmitters.h>
#import <react/renderer/components/KairoMarkdownTextSpec/Props.h>
#import <react/renderer/components/KairoMarkdownTextSpec/RCTComponentViewHelpers.h>
#import "RCTFabricComponentsPlugins.h"
#import "Utils.h"

using namespace facebook::react;

@interface KairoMarkdownTextRun () <RCTKairoMarkdownTextRunViewProtocol>

@end

@implementation KairoMarkdownTextRun {
  NSString * _text;
  RCTBubblingEventBlock _onPress;
  RCTBubblingEventBlock _onLongPress;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
    return concreteComponentDescriptorProvider<KairoMarkdownTextRunComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps = std::make_shared<const KairoMarkdownTextRunProps>();
    _props = defaultProps;
  }
  return self;
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps
{
  const auto &oldViewProps = *std::static_pointer_cast<KairoMarkdownTextRunProps const>(_props);
  const auto &newViewProps = *std::static_pointer_cast<KairoMarkdownTextRunProps const>(props);

  if (newViewProps.text != oldViewProps.text) {
    NSString *text = [NSString stringWithUTF8String:newViewProps.text.c_str()];
    _text = text;
  }

  [super updateProps:props oldProps:oldProps];
}

- (void)onPress {
  if (_eventEmitter != nullptr) {
    std::dynamic_pointer_cast<const facebook::react::KairoMarkdownTextRunEventEmitter>(_eventEmitter)
    ->onPress(facebook::react::KairoMarkdownTextRunEventEmitter::OnPress{});
  }
}

- (void)onLongPress {
  if (_eventEmitter != nullptr) {
    std::dynamic_pointer_cast<const facebook::react::KairoMarkdownTextRunEventEmitter>(_eventEmitter)
    ->onLongPress(facebook::react::KairoMarkdownTextRunEventEmitter::OnLongPress{});
  }
}

+ (BOOL)shouldBeRecycled {
  return NO;
}

Class<RCTComponentViewProtocol> KairoMarkdownTextRunCls(void)
{
    return KairoMarkdownTextRun.class;
}

@end
