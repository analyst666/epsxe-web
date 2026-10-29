# ePSXe Web - PowerShell Launcher
$Host.UI.RawUI.WindowTitle = "ePSXe Web - PlayStation 1 no Navegador"

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "       ePSXe Web - PlayStation 1 no Navegador" -ForegroundColor Yellow
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Iniciando servidor local com suporte a Threads e WebAssembly..." -ForegroundColor Green

Start-Job -ScriptBlock {
    Start-Sleep -Seconds 1
    Start-Process "http://127.0.0.1:8765/"
} | Out-Null

python server.py 8765
