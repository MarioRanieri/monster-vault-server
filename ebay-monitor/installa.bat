@echo off
title Installazione dipendenze
cd /d "%~dp0"
echo Installazione librerie Python necessarie...
py -m pip install -r requirements.txt
echo.
echo Installazione completata!
pause
