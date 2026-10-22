$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$tools=Join-Path $root '.android-tools'
$sdk=Join-Path $tools 'sdk'
$avdHome=Join-Path $tools 'avd'
$name='NongPlanner_API36'
$avd=Join-Path $avdHome "$name.avd"
foreach ($dir in @($sdk,$avdHome,$avd,"$sdk/system-images/android-36/default")) {New-Item -ItemType Directory -Force -Path $dir | Out-Null}
$packages=@(
  @{File='emulator.zip';Hash='488ed747e82de7e9bb5247becd1ac043c7e5e85d';Destination=$sdk;Entry="$sdk/emulator/emulator.exe"},
  @{File='platform-tools.zip';Hash='e03e78b1d80b396f1c3358e31251cb31740e1110';Destination=$sdk;Entry="$sdk/platform-tools/adb.exe"},
  @{File='android36-x86_64.zip';Hash='829c076e8ff448a336097ae25a355b495ba36e2c';Destination="$sdk/system-images/android-36/default";Entry="$sdk/system-images/android-36/default/x86_64/system.img"}
)
foreach ($p in $packages) {
  if (!(Test-Path -LiteralPath $p.Entry)) {
    $archive=Join-Path $tools $p.File
    if ((Get-FileHash -LiteralPath $archive -Algorithm SHA1).Hash -ne $p.Hash) {throw "Official archive checksum mismatch: $archive"}
    Expand-Archive -LiteralPath $archive -DestinationPath $p.Destination -Force
  }
}
$image=(Join-Path $sdk 'system-images/android-36/default/x86_64').Replace('\','/')
$config=@"
avd.ini.encoding=UTF-8
AvdId=$name
avd.ini.displayname=Nong Planner Android 16
PlayStore.enabled=false
abi.type=x86_64
disk.dataPartition.size=3G
fastboot.forceColdBoot=yes
hw.accelerometer=yes
hw.audioInput=no
hw.battery=yes
hw.camera.back=none
hw.camera.front=none
hw.cpu.arch=x86_64
hw.cpu.ncore=4
hw.dPad=no
hw.gps=yes
hw.gpu.enabled=yes
hw.gpu.mode=swiftshader
hw.initialOrientation=portrait
hw.keyboard=yes
hw.lcd.density=440
hw.lcd.height=2400
hw.lcd.width=1080
hw.mainKeys=no
hw.ramSize=3072
image.sysdir.1=$image/
runtime.network.latency=none
runtime.network.speed=full
showDeviceFrame=no
tag.display=Default
tag.id=default
target=android-36
vm.heapSize=256
"@
[IO.File]::WriteAllText((Join-Path $avd 'config.ini'),$config,(New-Object Text.UTF8Encoding($false)))
[IO.File]::WriteAllText((Join-Path $avdHome "$name.ini"),"avd.ini.encoding=UTF-8`npath=$avd`ntarget=android-36`n",(New-Object Text.UTF8Encoding($false)))
Write-Output "Prepared AVD: $avd"
Write-Output "SDK: $sdk"
