@echo off
cd /d "%~dp0"
set "HOST=0.0.0.0"
echo Nong Planner LAN sync: use this computer's LAN IP and port 4173 on your phone.
node server.mjs
pause
