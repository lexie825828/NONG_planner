$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$downloadRoot=Join-Path $root '.android-tools'
$sources=@(
 @{Url='https://dl.google.com/android/repository/emulator-windows_x64-16428233.zip';File='emulator.zip';Size=455342868L;Sha1='488ed747e82de7e9bb5247becd1ac043c7e5e85d'},
 @{Url='https://dl.google.com/android/repository/sys-img/android/x86_64-36_r02.zip';File='android36-x86_64.zip';Size=844217077L;Sha1='829c076e8ff448a336097ae25a355b495ba36e2c'}
)
$allJobs=@()
foreach($source in $sources){
 $file=Join-Path $downloadRoot $source.File
 if((Test-Path $file) -and (Get-Item $file).Length -eq $source.Size -and (Get-FileHash $file -Algorithm SHA1).Hash -eq $source.Sha1){continue}
 $planFile="$file.plan.json"
 if(Test-Path $planFile){$plan=Get-Content $planFile -Raw | ConvertFrom-Json}
 else{
  $prefix=if(Test-Path $file){(Get-Item $file).Length}else{0L}
  if($prefix -ge $source.Size){throw "Unexpected download size: $file"}
  $size=[long][math]::Ceiling(($source.Size-$prefix)/4.0)
  $jobs=@();for($i=0;$i -lt 4;$i++){$from=$prefix+$i*$size;if($from -ge $source.Size){break};$to=[math]::Min($source.Size-1,$from+$size-1);$jobs+=@{Url=$source.Url;From=$from;To=$to;File="$file.part$i"}}
  $plan=@{Prefix=$prefix;Source=$source;Jobs=$jobs};$plan | ConvertTo-Json -Depth 5 | Set-Content $planFile -Encoding utf8
 }
 $allJobs+=@($plan.Jobs)
}
$allJobs | ForEach-Object -Parallel {
 $ErrorActionPreference='Stop';$job=$_;$length=if(Test-Path $job.File){(Get-Item $job.File).Length}else{0L};$expected=[long]$job.To-[long]$job.From+1
 if($length -eq $expected){return};if($length -gt $expected){throw 'Partial download too large'}
 $handler=[Net.Http.HttpClientHandler]::new();$handler.Proxy=[Net.WebRequest]::GetSystemWebProxy();$client=[Net.Http.HttpClient]::new($handler);$client.Timeout=[TimeSpan]::FromMinutes(30)
 $request=[Net.Http.HttpRequestMessage]::new([Net.Http.HttpMethod]::Get,$job.Url);$from=[long]$job.From+$length;$request.Headers.Range=[Net.Http.Headers.RangeHeaderValue]::new($from,[long]$job.To)
 $response=$client.SendAsync($request,[Net.Http.HttpCompletionOption]::ResponseHeadersRead).GetAwaiter().GetResult()
 if([int]$response.StatusCode -ne 206 -or $response.Content.Headers.ContentRange.From -ne $from){throw 'Unexpected range response'}
 $input=$response.Content.ReadAsStreamAsync().GetAwaiter().GetResult();$output=[IO.File]::Open($job.File,[IO.FileMode]::Append,[IO.FileAccess]::Write,[IO.FileShare]::Read)
 try{$input.CopyToAsync($output).GetAwaiter().GetResult()}finally{$output.Dispose();$input.Dispose();$response.Dispose();$client.Dispose()}
 if((Get-Item $job.File).Length -ne $expected){throw 'Incomplete segment'}
 Write-Output "Segment complete: $([IO.Path]::GetFileName($job.File))"
} -ThrottleLimit 8
foreach($source in $sources){
 $file=Join-Path $downloadRoot $source.File
 if((Test-Path $file) -and (Get-Item $file).Length -eq $source.Size -and (Get-FileHash $file -Algorithm SHA1).Hash -eq $source.Sha1){continue}
 $plan=Get-Content "$file.plan.json" -Raw | ConvertFrom-Json
 if((Get-Item $file).Length -ne $plan.Prefix){throw 'Original download prefix changed'}
 $merged="$file.completed";$output=[IO.File]::Create($merged)
 try{foreach($part in @($file)+@($plan.Jobs | ForEach-Object {$_.File})){$input=[IO.File]::OpenRead($part);try{$input.CopyTo($output)}finally{$input.Dispose()}}}finally{$output.Dispose()}
 if((Get-Item $merged).Length -ne $source.Size -or (Get-FileHash $merged -Algorithm SHA1).Hash -ne $source.Sha1){throw "Checksum mismatch: $merged"}
 Move-Item -LiteralPath $merged -Destination $file -Force
 Write-Output "Downloaded and verified: $($source.File)"
}
