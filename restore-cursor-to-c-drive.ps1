# Restore Cursor Data to C Drive (Rollback Script)
# This script reverses the move operation if something goes wrong

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Restore Cursor Data to C Drive" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "Right-click the script and select 'Run as Administrator'" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if Cursor is running
Write-Host "Checking if Cursor is running..." -ForegroundColor Yellow
$cursorProcesses = Get-Process -Name "Cursor" -ErrorAction SilentlyContinue
if ($cursorProcesses) {
    Write-Host "ERROR: Cursor is still running!" -ForegroundColor Red
    Write-Host "Please close Cursor completely before running this script." -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "✓ Cursor is not running" -ForegroundColor Green
Write-Host ""

# Define paths
$linkPath = "C:\Users\casey\AppData\Roaming\Cursor"
$dataPath = "F:\CursorData\Cursor"

# Check if symbolic link exists
if (-not (Test-Path $linkPath)) {
    Write-Host "ERROR: Symbolic link not found at: $linkPath" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if it's actually a symbolic link
$item = Get-Item $linkPath
if ($item.LinkType -ne "SymbolicLink") {
    Write-Host "ERROR: $linkPath is not a symbolic link" -ForegroundColor Red
    Write-Host "It appears to be a regular directory. Aborting to avoid data loss." -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if F drive data exists
if (-not (Test-Path $dataPath)) {
    Write-Host "ERROR: Data not found at: $dataPath" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "About to restore Cursor data to C drive..." -ForegroundColor Yellow
Write-Host "  FROM: $dataPath" -ForegroundColor White
Write-Host "  TO:   $linkPath" -ForegroundColor White
Write-Host ""
$confirm = Read-Host "Continue? (yes/no)"
if ($confirm -ne "yes") {
    Write-Host "Operation cancelled." -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 0
}

Write-Host ""
Write-Host "[1/2] Removing symbolic link..." -ForegroundColor Yellow
Remove-Item $linkPath -Force
Write-Host "✓ Symbolic link removed" -ForegroundColor Green
Write-Host ""

Write-Host "[2/2] Moving data back to C drive..." -ForegroundColor Yellow
Write-Host "This may take several minutes..." -ForegroundColor Gray
try {
    Move-Item -Path $dataPath -Destination $linkPath -Force
    Write-Host "✓ Successfully restored data to C drive" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Failed to move data back!" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  RESTORE COMPLETE" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Cursor data has been restored to C drive." -ForegroundColor Green
Write-Host "You can now open Cursor normally." -ForegroundColor Green
Write-Host ""
Read-Host "Press Enter to exit"
