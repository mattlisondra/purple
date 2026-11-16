@echo off
rem Opens the PURPLE pages on this computer at http://localhost:8000
cd /d "%~dp0"
echo Serving PURPLE at http://localhost:8000/purple-funding.html  (close this window to stop)
start "" "http://localhost:8000/purple-funding.html"
python -m http.server 8000 || py -m http.server 8000
pause
