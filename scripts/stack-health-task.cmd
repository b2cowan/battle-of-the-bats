@echo off
rem Launcher for the morning stack health check (scripts/stack-health.mjs --scheduled).
rem Registered as the Windows task "FieldLogicHQ stack health" by scripts/stack-health-schedule.ps1.
rem Output of the last run goes to .health\last-run.log (gitignored), for when something fails.
cd /d "%~dp0.."
if not exist .health mkdir .health
node scripts\stack-health.mjs --scheduled > .health\last-run.log 2>&1
