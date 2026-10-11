param([string]$TargetFolder='')
$ErrorActionPreference='Stop'
$taskPackageRoot=[IO.Path]::GetFullPath($PSScriptRoot)
$taskArchive=Join-Path $taskPackageRoot 'original-master.zip'
$taskExpected='23d6547b2b3e4fd3df629329825dd207e673101cff18ebe3c371d71a0ac8a66d'
if((Get-FileHash -LiteralPath $taskArchive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskExpected){throw 'Original ZIP SHA256 mismatch.'}
if(!$TargetFolder){$TargetFolder=Join-Path $taskPackageRoot ('restored-original-'+(Get-Date -Format 'yyyyMMdd-HHmmss'))}
$taskTarget=[IO.Path]::GetFullPath($TargetFolder)
if(!$taskTarget.StartsWith($taskPackageRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Restore target must remain inside this delivery folder.'}
if(Test-Path -LiteralPath $taskTarget){throw 'Restore target already exists. Choose a new folder; nothing will be overwritten.'}
Add-Type -AssemblyName System.IO.Compression.FileSystem
$taskZip=[IO.Compression.ZipFile]::OpenRead($taskArchive)
try{foreach($taskEntry in $taskZip.Entries){$taskResolved=[IO.Path]::GetFullPath((Join-Path $taskTarget $taskEntry.FullName));if(!$taskResolved.StartsWith($taskTarget+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'ZIP path outside restore directory.'}}}finally{$taskZip.Dispose()}
[IO.Compression.ZipFile]::ExtractToDirectory($taskArchive,$taskTarget)
Write-Host ('Original restored to: '+$taskTarget)
Write-Host 'Development and production files were not changed.'
