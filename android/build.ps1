param([string]$JdkPath='', [string]$SdkTools='', [string]$SdkPlatform='', [switch]$EmulatorTest)
$ErrorActionPreference='Stop'
$projectRoot=Split-Path -Parent $PSScriptRoot
if (!$JdkPath) {
  if ($env:JAVA_HOME -and (Test-Path (Join-Path $env:JAVA_HOME 'bin/javac.exe'))) {$JdkPath=$env:JAVA_HOME}
  elseif (Get-Command javac -ErrorAction SilentlyContinue) {$JdkPath=Split-Path -Parent (Split-Path -Parent (Get-Command javac).Source)}
  else {$JdkPath=Get-ChildItem 'C:/Program Files/JetBrains' -Filter javac.exe -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1 | ForEach-Object {Split-Path -Parent (Split-Path -Parent $_.FullName)}}
}
if (!$SdkTools) {$SdkTools=Join-Path $projectRoot '.android-tools/build-tools/android-15'}
if (!$SdkPlatform) {$SdkPlatform=Join-Path $projectRoot '.android-tools/platform/android-35'}
foreach ($check in @((Join-Path $JdkPath 'bin/javac.exe'),(Join-Path $SdkTools 'aapt2.exe'),(Join-Path $SdkPlatform 'android.jar'))) {if (!(Test-Path -LiteralPath $check)) {throw "Missing build dependency: $check. See android/README.md"}}
$build=Join-Path $PSScriptRoot 'build'
$output=Join-Path $projectRoot 'output/android'
foreach ($folder in @($build,"$build/assets/www","$build/classes","$build/dex",$output,"$PSScriptRoot/keys")) {New-Item -ItemType Directory -Force -Path $folder | Out-Null}
Copy-Item -Path "$projectRoot/public/*" -Destination "$build/assets/www" -Force
function CheckExit([string]$step) {if ($LASTEXITCODE -ne 0) {throw "$step failed ($LASTEXITCODE)"}}
& "$SdkTools/aapt2.exe" compile --dir "$PSScriptRoot/res" -o "$build/resources.zip"
CheckExit 'Compile resources'
$manifestPath="$PSScriptRoot/AndroidManifest.xml"
if ($EmulatorTest) {
  $manifestPath="$build/AndroidManifest-test.xml"
  $manifestSource=[IO.File]::ReadAllText("$PSScriptRoot/AndroidManifest.xml").Replace('<application ','<application android:debuggable="true" ')
  [IO.File]::WriteAllText($manifestPath,$manifestSource,(New-Object Text.UTF8Encoding($false)))
}
& "$SdkTools/aapt2.exe" link -I "$SdkPlatform/android.jar" --manifest $manifestPath -o "$build/resources.apk" "$build/resources.zip"
CheckExit 'Link APK assets'
& "$JdkPath/bin/javac.exe" -encoding UTF-8 --release 8 -classpath "$SdkPlatform/android.jar" -d "$build/classes" @((Get-ChildItem "$PSScriptRoot/src/com/nongplanner/app" -Filter "*.java").FullName)
CheckExit 'Compile Java'
$classFiles=@(Get-ChildItem "$build/classes" -Filter '*.class' -Recurse | ForEach-Object {$_.FullName})
$previousJavaHome=$env:JAVA_HOME
try {
  $env:JAVA_HOME=$JdkPath
  & "$SdkTools/d8.bat" --min-api 26 --lib "$SdkPlatform/android.jar" --output "$build/dex" @classFiles
  CheckExit 'Compile DEX'
  Copy-Item "$build/resources.apk" "$build/unsigned.apk" -Force
  Add-Type -AssemblyName System.IO.Compression
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $zip=[IO.Compression.ZipFile]::Open("$build/unsigned.apk",[IO.Compression.ZipArchiveMode]::Update)
  try {
    [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,"$build/dex/classes.dex",'classes.dex',[IO.Compression.CompressionLevel]::Optimal) | Out-Null
    # aapt2 -A on Windows can emit assets/www\index.html. Android requires slash-only ZIP names.
    foreach ($asset in (Get-ChildItem "$projectRoot/public" -File -Recurse)) {
      $relative=$asset.FullName.Substring((Join-Path $projectRoot 'public').Length).TrimStart('\','/').Replace('\','/')
      [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,$asset.FullName,"assets/www/$relative",[IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
  } finally {$zip.Dispose()}
  & "$SdkTools/zipalign.exe" -f 4 "$build/unsigned.apk" "$build/aligned.apk"
  CheckExit 'Align APK'
  $keyStore="$PSScriptRoot/keys/nong-personal.jks"
  $keyPassword="$PSScriptRoot/keys/password.txt"
  if (!(Test-Path $keyStore)) {
    if (!(Test-Path $keyPassword)) {[byte[]]$bytes=New-Object byte[] 32;[System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes);[IO.File]::WriteAllText($keyPassword,[Convert]::ToBase64String($bytes),(New-Object Text.UTF8Encoding($false)))}
    & "$JdkPath/bin/keytool.exe" -genkeypair -keystore $keyStore -storepass:file $keyPassword -keypass:file $keyPassword -alias nong-personal -keyalg RSA -keysize 3072 -validity 10000 -dname 'CN=Nong Planner Personal, OU=Personal App, O=Nong Planner' -noprompt
    CheckExit 'Create personal signing certificate'
  }
  $apkName=if ($EmulatorTest) {'Nong-Planner-0.4.1-emulator-test.apk'} else {'Nong-Planner-0.4.1.apk'}
  $apk=Join-Path $output $apkName
  & "$SdkTools/apksigner.bat" sign --ks $keyStore --ks-key-alias nong-personal --ks-pass "file:$keyPassword" --out $apk "$build/aligned.apk"
  CheckExit 'Sign APK'
  & "$SdkTools/apksigner.bat" verify --verbose $apk
  CheckExit 'Verify APK signature'
  & "$SdkTools/zipalign.exe" -c 4 $apk
  CheckExit 'Verify APK alignment'
  & "$JdkPath/bin/javac.exe" -encoding UTF-8 --release 8 -d "$build/asset-tests" "$PSScriptRoot/src/com/nongplanner/app/LocalAssets.java" "$PSScriptRoot/tests/LocalAssetsTest.java"
  CheckExit 'Compile native asset regression test'
  & "$JdkPath/bin/java.exe" -cp "$build/asset-tests" LocalAssetsTest $apk
  CheckExit 'Verify real ZIP paths and all startup resources'
  $checksum=(Get-FileHash -LiteralPath $apk -Algorithm SHA256).Hash.ToLowerInvariant()
  [IO.File]::WriteAllText("$apk.sha256","$checksum  $apkName`n")
  Write-Output "APK ready: $apk"
} finally {$env:JAVA_HOME=$previousJavaHome}
