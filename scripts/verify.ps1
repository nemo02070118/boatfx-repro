$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")
python -m pip install -q -r requirements.txt
python repro.py
python reproduce_headline.py
Write-Host "OK: verify passed" -ForegroundColor Green
