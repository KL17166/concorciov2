@echo off
title Request Inspector Pro - Servidor Local
color 0A
echo.
echo  ============================================
echo   REQUEST INSPECTOR PRO - SERVIDOR LOCAL
echo  ============================================
echo.
echo  [1] Certifique-se de ter recarregado a extensao no Chrome
echo      chrome://extensions/ ^> Request Inspector Pro ^> Reload (botao circular)
echo.
echo  [2] Servidor iniciando na porta 7331...
echo  [3] Arquivos serao salvos em: captures\
echo.
echo  ============================================
echo.
node "%~dp0server.js"
pause
