#import <React/RCTViewManager.h>
#import <React/RCTUIManager.h>
#import "RCTBridge.h"
#import "Utils.h"

@interface KairoMarkdownTextManager : RCTViewManager
@end

@implementation KairoMarkdownTextManager

RCT_EXPORT_MODULE(KairoMarkdownText)

- (UIView *)view
{
  return [[UIView alloc] init];
}

RCT_CUSTOM_VIEW_PROPERTY(color, NSString, UIView)
{
}

@end

@interface KairoMarkdownTextRunManager : RCTViewManager
@end

@implementation KairoMarkdownTextRunManager

RCT_EXPORT_MODULE(KairoMarkdownTextRun)

- (UIView *)view
{
  return nil;
}

@end
