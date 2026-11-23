<#
  Scriptorium improvements: installer.

  install   Builds the improved display files from YOUR installed copy of Scriptorium and puts them in place.
  check     Only reports whether the improvements are installed.

  Nothing of Scriptorium itself is in this repository: the build reads the program's own app.js, style.css and
  index.html from your computer and adds the improvements to them (source\patch.py). Your notes, bookmarks and
  the Bible library are not touched. Needs Python 3 (python.org); nothing else is installed.
#>
param([ValidateSet('install', 'check')][string]$Action = 'check', [string]$Program = (Join-Path $env:LOCALAPPDATA 'Programs\Scriptorium'))
$ErrorActionPreference = 'Stop'

$Static  = Join-Path $Program '_internal\static'
$Source  = Join-Path (Split-Path $PSScriptRoot -Parent) 'source'
$Backups = Join-Path $env:LOCALAPPDATA 'Scriptorium improvements'
# The original files of the Scriptorium version these improvements are made for (release 2026.10.31).
$Original = @{
  'app.js'     = '18F17CC7DEDA4A556DB01912DD5A83811832700CB04D84BFEA8FEDF610130C00'
  'style.css'  = '2689FD43FD875B8EA364F20E229CEBA23F359AC6CF82135E96E0E1EA6CB86ED1'
  'index.html' = '84FC8D6ECCA4260F028AFC719B42D688FD303D613A8897B6FE8604D66EA6755A'
}

function Say($text, $color = 'Gray') { Write-Host $text -ForegroundColor $color }
function Hash($path) { if (Test-Path $path) { (Get-FileHash $path -Algorithm SHA256).Hash } else { $null } }
function Done($code) { Write-Host ''; if (-not $env:SCRIPTORIUM_NO_PAUSE) { Read-Host 'Press Enter to close' | Out-Null }; exit $code }

Say ''; Say 'Scriptorium improvements' 'Cyan'; Say '------------------------' 'Cyan'
if (-not (Test-Path (Join-Path $Static 'app.js'))) { Say "Scriptorium is not installed where expected:`n  $Static" 'Red'; Done 1 }

$improved = Select-String -Path (Join-Path $Static 'app.js') -Pattern 'BEGIN SCRIPTORIUM' -SimpleMatch -Quiet
if ($Action -eq 'check') {
  if ($improved) { Say 'The improvements are installed.' 'Green' } else { Say 'Scriptorium has its own files: run "Install Scriptorium improvements".' 'Yellow' }
  Done 0
}

# 1. Find Scriptorium's original files: in the program, or kept from an earlier install.
$originals = @{}
foreach ($f in $Original.Keys) {
  $here = Join-Path $Static $f
  if ((Hash $here) -eq $Original[$f]) { $originals[$f] = $here; continue }
  $kept = Get-ChildItem $Backups -Recurse -Filter $f -ErrorAction SilentlyContinue | Where-Object { (Hash $_.FullName) -eq $Original[$f] } | Select-Object -First 1
  if ($kept) { $originals[$f] = $kept.FullName; continue }
  if ($improved) { Say "The original $f is needed but was not found (it is kept in $Backups after the first install)." 'Red' }
  else { Say "This Scriptorium is a different version from the one the improvements were made for ($f differs). Nothing was changed." 'Yellow' }
  Done 1
}

# 2. Python.
$py = $null
foreach ($c in 'py -3', 'python', 'python3') {
  $exe, $pre = $c -split ' ', 2; $pre = @($pre | Where-Object { $_ })
  try { & $exe @($pre + @('-c', 'import sys; sys.exit(0 if sys.version_info >= (3, 8) else 1)')) 2>$null; if ($LASTEXITCODE -eq 0) { $py = @{ exe = $exe; pre = $pre }; break } } catch {}
}
if (-not $py) { Say 'Python 3 is needed to build the improvements. Install it from https://www.python.org/downloads/ (tick "Add python.exe to PATH"), then run this again.' 'Yellow'; Done 1 }

if (Get-Process -Name 'Scriptorium' -ErrorAction SilentlyContinue) { Say 'Please close Scriptorium first (all its windows), then run this again.' 'Yellow'; Done 1 }

# 3. Build from the originals.
$work = Join-Path $env:TEMP ('scriptorium-build-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
$src = Join-Path $work 'original'; $out = Join-Path $work 'out'
New-Item -ItemType Directory -Force -Path $src, (Join-Path $out 'atlas') | Out-Null
foreach ($f in $originals.Keys) { Copy-Item $originals[$f] (Join-Path $src $f) }
Say 'Building the improvements (about a minute) …'
& $py.exe @($py.pre + @((Join-Path $Source 'patch.py'), $src, $out))
if ($LASTEXITCODE -ne 0) { Say 'The build failed; nothing was changed.' 'Red'; Done 1 }

# 4. Keep the originals once, then copy the build in.
$keep = Join-Path $Backups 'original-files'
if (-not (Test-Path $keep)) { New-Item -ItemType Directory -Force -Path $keep | Out-Null; foreach ($f in $originals.Keys) { Copy-Item $originals[$f] (Join-Path $keep $f) } }
robocopy $out $Static /E /R:1 /W:1 /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { Say 'Some files could not be copied.' 'Red'; Done 1 }
Remove-Item $work -Recurse -Force -ErrorAction SilentlyContinue
Say "Done. Open Scriptorium. (Scriptorium's own files are kept in $keep; reinstall Scriptorium to undo.)" 'Green'
Done 0
