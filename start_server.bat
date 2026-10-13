@echo off
REM Double-click to start the server on Windows (venv must already exist).
cd /d "%~dp0"
call venv\Scripts\activate
python app.py
pause
