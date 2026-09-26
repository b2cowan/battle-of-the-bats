# Registers (or removes) the Windows task that runs the morning stack health check.
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\stack-health-schedule.ps1            # install / update
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\stack-health-schedule.ps1 -Remove    # uninstall
#
# Daily at 7:30 a.m. local, as the logged-on user (no stored password). StartWhenAvailable: if the PC was
# asleep or off at 7:30, it runs as soon as it can. It runs headless (no console window) through the
# launcher scripts\stack-health-task.cmd. Plan: docs/projects/active/STACK_HEALTH_CHECK_PLAN.md §5.
param([switch]$Remove, [string]$At = '7:30am')

$name = 'FieldLogicHQ stack health'
if ($Remove) {
  Unregister-ScheduledTask -TaskName $name -Confirm:$false -ErrorAction SilentlyContinue
  "Removed the task '$name'."
  return
}

$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$launcher = Join-Path $repo 'scripts\stack-health-task.cmd'
if (-not (Test-Path $launcher)) { throw "Launcher not found: $launcher" }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'node is not on PATH for this user.' }

# conhost --headless runs the .cmd without flashing a console window (Windows 10 21H1+ / 11).
$action = New-ScheduledTaskAction -Execute 'conhost.exe' -Argument "--headless `"$launcher`"" -WorkingDirectory $repo
$trigger = New-ScheduledTaskTrigger -Daily -At $At
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -RunOnlyIfNetworkAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 15) -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force `
  -Description 'FieldLogicHQ morning stack health check (database, traffic, deploys, agent tooling). Report: .health\latest.md in the repo. See docs/projects/active/STACK_HEALTH_CHECK_PLAN.md.' | Out-Null

$t = Get-ScheduledTask -TaskName $name
$i = $t | Get-ScheduledTaskInfo
"Installed '$name': $($t.State), next run $($i.NextRunTime)"
