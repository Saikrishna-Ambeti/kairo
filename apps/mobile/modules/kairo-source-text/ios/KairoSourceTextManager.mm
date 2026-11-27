#import <React/RCTUIManager.h>
#import <React/RCTViewManager.h>

@interface KairoSourceTextManager : RCTViewManager
@end

@implementation KairoSourceTextManager

RCT_EXPORT_MODULE(KairoSourceText)

- (UIView *)view {
  return [[UIView alloc] init];
}

@end

@interface KairoSourceTextRunManager : RCTViewManager
@end

@implementation KairoSourceTextRunManager

RCT_EXPORT_MODULE(KairoSourceTextRun)

- (UIView *)view {
  return nil;
}

@end
