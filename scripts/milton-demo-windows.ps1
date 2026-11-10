<#
  Milton Bats demo — open every persona's browser window, tiled, on staging.

  All windows are Chrome. Each persona gets its OWN saved browser profile (a separate
  --user-data-dir), so the sessions never bleed into each other (unlike Incognito, where every
  private window shares one sign-in and forgets it on close).

  Every run signs each persona in automatically (scripts/milton-demo-signin.mjs makes a one-time
  sign-in link against the DEV database — no email sent, no password typed). The public window
  is never signed in. A demo-world reset (npm run demo:milton:reset) does not sign anyone out.

  Run it again at any time: it closes only the demo windows and re-opens them in place.
  Your everyday Chrome is never touched.

  Usage (PowerShell):
    .\scripts\milton-demo-windows.ps1              # four full-size windows, cascaded (owner in front)
    .\scripts\milton-demo-windows.ps1 -Install     # put a "Milton demo windows" shortcut on the Desktop
    .\scripts\milton-demo-windows.ps1 -Layout Grid # 2 x 2 (only readable on a big or second monitor)
    .\scripts\milton-demo-windows.ps1 -Monitor 2   # open on the second monitor
    .\scripts\milton-demo-windows.ps1 -Layout Row  # four side-by-side columns (an ultrawide)
    .\scripts\milton-demo-windows.ps1 -WithParent  # add the parent as a fifth window (normally on the phone)

  Landing screens are deliberately the ones whose address survives a reset (season screens in
  admin carry an id that changes on every rebuild — click through from the landing instead).
#>
[CmdletBinding()]
param(
  [switch]$Install,
  [int]$Monitor = 1,
  [ValidateSet('Stack', 'Grid', 'Row')][string]$Layout = 'Stack',
  [switch]$WithParent,
  [string]$BaseUrl = 'https://dev.fieldlogichq.ca'
)

$ErrorActionPreference = 'Stop'
$org = 'milton-bats'
$season = '2027-summer-house-league'   # public season slug, stable across resets

$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$profileRoot = Join-Path $env:LOCALAPPDATA 'FieldLogicDemo\milton'
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSCommandPath)

# Who opens where. Order = tile order (left-to-right, top-to-bottom).
# Email set = the window is signed in automatically as that person on every run; no Email = stays signed out.
$personas = @(
  @{ Key = 'owner';  Email = 'b2cowan+owner@gmail.com';   Next = "/$org/admin";              Note = 'Owner (Jordan Whitfield, President)' }
  @{ Key = 'admin';  Email = 'b2cowan+hladmin@gmail.com'; Next = "/$org/admin/house-league"; Note = 'League admin (Kelly Barrett)' }
  @{ Key = 'coach';  Email = 'b2cowan+coach@gmail.com';   Next = '/discover';                Note = 'House-league coach (Ryan Delaney)' }
  @{ Key = 'public'; Email = $null;                       Next = "/$org/league/$season";     Note = 'Public, signed OUT - never sign in here' }
)
if ($WithParent) {
  # No account exists until the parent accepts the family-app invitation; until then this opens the sign-in page.
  $personas += @{ Key = 'parent'; Email = 'b2cowan+parent@gmail.com'; Next = '/family'; Note = 'Parent (Taylor Brennan)' }
}

if ($Install) {
  $desktop = [Environment]::GetFolderPath('Desktop')
  $lnkPath = Join-Path $desktop 'Milton demo windows.lnk'
  $shell = New-Object -ComObject WScript.Shell
  $lnk = $shell.CreateShortcut($lnkPath)
  $lnk.TargetPath = 'powershell.exe'
  $lnk.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$PSCommandPath`""
  $lnk.WorkingDirectory = $repoRoot
  $lnk.IconLocation = "$chrome,0"
  $lnk.Description = 'Open the Milton Bats demo windows (owner, admin, coach, public), tiled, on staging'
  $lnk.Save()
  Write-Host "Shortcut created: $lnkPath"

  # Second shortcut: fresh "scan and you're signed in" phone codes (league admin + coach).
  $node = (Get-Command node -ErrorAction Stop).Source
  $phonePath = Join-Path $desktop 'Milton phone sign-in.lnk'
  $ph = $shell.CreateShortcut($phonePath)
  $ph.TargetPath = $node
  $ph.Arguments = '--no-warnings --env-file=.env.local scripts/milton-phone-codes.mjs'
  $ph.WorkingDirectory = $repoRoot
  $ph.WindowStyle = 7   # minimized: the page it opens is the point, not the console
  $ph.IconLocation = "$chrome,0"
  $ph.Description = 'Make fresh scan-to-sign-in phone codes (league admin, coach) for the Milton demo'
  $ph.Save()
  Write-Host "Shortcut created: $phonePath"
  return
}

if (-not (Test-Path $chrome)) { throw "Chrome not found: $chrome" }

# 0. A ready-signed-in link for each person (dev database only; no email is sent, no password typed).
$signedIn = @{}
$specs = $personas | Where-Object { $_.Email } | ForEach-Object { "$($_.Key)=$($_.Email)=$($_.Next)" }
if ($specs) {
  Push-Location $repoRoot
  try {
    # Windows PowerShell turns a native program's stderr into errors; keep them as plain lines here.
    $ErrorActionPreference = 'Continue'
    $outLines = & node --no-warnings --env-file=.env.local scripts/milton-demo-signin.mjs $BaseUrl @specs 2>&1
    $ErrorActionPreference = 'Stop'
    $outLines | Where-Object { $_ -is [System.Management.Automation.ErrorRecord] } | ForEach-Object { Write-Warning "$_" }
    $json = ($outLines | Where-Object { $_ -isnot [System.Management.Automation.ErrorRecord] }) -join ''
    if ($json) { ($json | ConvertFrom-Json).PSObject.Properties | ForEach-Object { $signedIn[$_.Name] = $_.Value } }
  } catch {
    Write-Warning "Automatic sign-in did not run ($($_.Exception.Message)). The windows open on the sign-in page instead."
  } finally { Pop-Location }
}
foreach ($p in $personas) {
  if ($p.Email -and $signedIn.ContainsKey($p.Key)) { $p.Url = $signedIn[$p.Key] }
  elseif ($p.Email) { $p.Url = "$BaseUrl/auth/login?next=$([uri]::EscapeDataString($p.Next))" }
  else { $p.Url = "$BaseUrl$($p.Next)" }
}

# 1. Close any demo windows already open (matched by their own profile folder only).
$procs = Get-CimInstance Win32_Process -Filter "Name = 'chrome.exe'" |
  Where-Object { $_.CommandLine -and $_.CommandLine -like "*$profileRoot*" }
if ($procs) {
  $procs | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch {} }
  Start-Sleep -Milliseconds 1200   # let the profile locks release before re-opening
}

# 2. Work out the tiles on the chosen monitor (working area = above the taskbar).
Add-Type -AssemblyName System.Windows.Forms
$screens = [System.Windows.Forms.Screen]::AllScreens | Sort-Object { $_.Bounds.X }, { $_.Bounds.Y }
if ($Monitor -lt 1 -or $Monitor -gt $screens.Count) { throw "Monitor $Monitor not found (this PC has $($screens.Count))." }
$area = $screens[$Monitor - 1].WorkingArea

$n = $personas.Count
$step = 32   # Stack: each window steps right/down this far so every title bar stays visible
if ($Layout -eq 'Stack') {
  $w = $area.Width - $step * ($n - 1); $h = $area.Height - $step * ($n - 1)
} else {
  if ($Layout -eq 'Row') { $cols = $n; $rows = 1 }
  else { $cols = [Math]::Ceiling($n / 2); $rows = [Math]::Ceiling($n / $cols) }
  $w = [Math]::Floor($area.Width / $cols)
  $h = [Math]::Floor($area.Height / $rows)
}

# 3. Open each persona in its own profile, at its place. The last window opened sits in front,
#    so Stack opens in reverse: the owner opens last and is the window you see first.
$order = 0..($n - 1)
if ($Layout -eq 'Stack') { [Array]::Reverse($order) }
foreach ($i in $order) {
  $p = $personas[$i]
  $dir = Join-Path $profileRoot $p.Key
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  if ($Layout -eq 'Stack') {
    $x = $area.X + $i * $step; $y = $area.Y + $i * $step
  } else {
    $x = $area.X + ($i % $cols) * $w
    $y = $area.Y + [Math]::Floor($i / $cols) * $h
  }
  $argList = @(
    "--user-data-dir=`"$dir`"",
    '--no-first-run', '--no-default-browser-check',
    "--window-position=$x,$y", "--window-size=$w,$h",
    '--new-window', $p.Url
  )
  Start-Process -FilePath $chrome -ArgumentList $argList | Out-Null
  Start-Sleep -Milliseconds 400   # keep the front-to-back order the same as the launch order
  $state = if (-not $p.Email) { 'signed out' } elseif ($signedIn.ContainsKey($p.Key)) { "signed in as $($p.Email)" } else { "SIGN-IN PAGE ($($p.Email))" }
  Write-Host ("{0,-7} {1} - {2}" -f $p.Key, $p.Note, $state)
}
