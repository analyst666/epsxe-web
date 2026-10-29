@echo off
chcp 65001 > nul
title ePSXe Web - Servidor Local
echo ========================================================
echo        ePSXe Web - PlayStation 1 no Navegador
echo ========================================================
echo.
echo Iniciando servidor local com suporte a Threads e WebAssembly...
start http://127.0.0.1:8765/
python server.py 8765
pause
