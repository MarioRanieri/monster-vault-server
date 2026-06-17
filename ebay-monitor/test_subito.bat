@echo off
chcp 65001 >nul
title Monster eBay Monitor - TEST invio immediato
cd /d "%~dp0"
echo ============================================================
echo  TEST: mando SUBITO su Telegram gli annunci Monster Energy
echo  listati nell'ULTIMA ORA (max 10 per ricerca).
echo.
echo  Se non arriva niente, vuol dire che in quest'ora non ci
echo  sono annunci nuovi: e' NORMALE (il radar vero gira H24).
echo ============================================================
echo.
py ebay_monitor.py --send-now 10
echo.
echo === Finito. Controlla Telegram. ===
pause
