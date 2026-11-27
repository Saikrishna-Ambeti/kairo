Pod::Spec.new do |s|
  s.name = 'KairoVoiceTranscription'
  s.version = '1.0.0'
  s.summary = 'Local recording conversion for Kairo dictation.'
  s.author = 'Kairo Tools'
  s.homepage = 'https://t3tools.com'
  s.platform = :ios, '18.0'
  s.source = { :path => '.' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '*.swift'
  s.frameworks = 'AudioToolbox'
end
