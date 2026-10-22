param([switch]$SoftwareCpu,[switch]$Visible)
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$sdk=Join-Path $root '.android-tools/sdk'
$env:ANDROID_SDK_ROOT=$sdk
$env:ANDROID_HOME=$sdk
$env:ANDROID_AVD_HOME=Join-Path $root '.android-tools/avd'
$argsList=@('-avd','NongPlanner_API36','-port','5554','-no-audio','-no-snapshot','-no-metrics','-gpu','swiftshader','-no-boot-anim')
if (!$Visible) {$argsList+='-no-window'}
if ($SoftwareCpu) {$argsList+=@('-accel','off')}
& "$sdk/emulator/emulator.exe" @argsList
