# Helper script to export n8n workflows locally into ./workflows/
$ErrorActionPreference = "Stop"

if (-not (Test-Path -Path "./workflows")) {
    New-Item -ItemType Directory -Force -Path "./workflows" | Out-Null
}

Write-Host "Exporting workflows to ./workflows/..."
n8n export:workflow --backup --output="./workflows/"
Write-Host "Export completed successfully."
