@echo off
rem Double-click to start the stream graphics server.
cd /d "%~dp0"
start "" http://localhost:8080/control/
python server.py %*
pause
