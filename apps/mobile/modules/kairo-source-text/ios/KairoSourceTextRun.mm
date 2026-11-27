#import "KairoSourceTextRun.h"
#import <React/RCTFabricComponentsPlugins.h>
#import "KairoSourceTextRunComponentDescriptor.h"
#import <react/renderer/components/KairoSourceTextSpec/Props.h>
#import <react/renderer/components/KairoSourceTextSpec/RCTComponentViewHelpers.h>

using namespace facebook::react;

@interface KairoSourceTextRun () <RCTT3SourceTextRunViewProtocol>

@end

@implementation KairoSourceTextRun {
  NSString *_text;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider {
  return concreteComponentDescriptorProvider<
      KairoSourceTextRunComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame {
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps =
        std::make_shared<const KairoSourceTextRunProps>();
    _props = defaultProps;
  }
  return self;
}

- (void)updateProps:(Props::Shared const &)props
           oldProps:(Props::Shared const &)oldProps {
  const auto &oldViewProps =
      *std::static_pointer_cast<KairoSourceTextRunProps const>(_props);
  const auto &newViewProps =
      *std::static_pointer_cast<KairoSourceTextRunProps const>(props);

  if (newViewProps.text != oldViewProps.text) {
    NSString *text = [NSString stringWithUTF8String:newViewProps.text.c_str()];
    _text = text;
  }

  [super updateProps:props oldProps:oldProps];
}

+ (BOOL)shouldBeRecycled {
  return NO;
}

Class<RCTComponentViewProtocol> KairoSourceTextRunCls(void) {
  return KairoSourceTextRun.class;
}

@end
