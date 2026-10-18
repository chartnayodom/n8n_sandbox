#!/usr/bin/env bash
set -e

# Helper script to export n8n workflows locally into ./workflows/
mkdir -p ./workflows
echo "Exporting workflows to ./workflows/..."
n8n export:workflow --backup --output=./workflows/
echo "Export completed successfully."
