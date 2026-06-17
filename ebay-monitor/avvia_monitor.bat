@echo off
chcp 65001 >nul
title Monster Energy eBay Monitor
cd /d "%~dp0"
echo Avvio Monster Energy eBay Monitor...
py ebay_monitor.py
pause
