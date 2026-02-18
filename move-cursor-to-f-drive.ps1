# Move Cursor Data to F Drive
# This script moves Cursor's AppData from C drive to F drive and creates a symbolic link

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Move Cursor Data to F Drive" -ForegroundColor Cyan
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
    Write-Host ""
    Write-Host "Found these Cursor processes:" -ForegroundColor Yellow
    $cursorProcesses | Format-Table Id, ProcessName, StartTime
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "✓ Cursor is not running" -ForegroundColor Green
Write-Host ""

# Define paths
$sourceDir = "C:\Users\casey\AppData\Roaming\Cursor"
$destDir = "F:\CursorData\Cursor"
$destParent = "F:\CursorData"

# Check if source exists
if (-not (Test-Path $sourceDir)) {
    Write-Host "ERROR: Source directory not found: $sourceDir" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if destination already exists
if (Test-Path $destDir) {
    Write-Host "WARNING: Destination already exists: $destDir" -ForegroundColor Yellow
    $response = Read-Host "Do you want to overwrite it? (yes/no)"
    if ($response -ne "yes") {
        Write-Host "Operation cancelled." -ForegroundColor Yellow
        Read-Host "Press Enter to exit"
        exit 0
    }
    Remove-Item $destDir -Recurse -Force
}

# Calculate size
Write-Host "Calculating size to move..." -ForegroundColor Yellow
$size = (Get-ChildItem $sourceDir -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1GB
Write-Host "Size to move: $([math]::Round($size, 2)) GB" -ForegroundColor Cyan
Write-Host ""

# Confirm
Write-Host "About to move:" -ForegroundColor Yellow
Write-Host "  FROM: $sourceDir" -ForegroundColor White
Write-Host "  TO:   $destDir" -ForegroundColor White
Write-Host ""
$confirm = Read-Host "Continue? (yes/no)"
if ($confirm -ne "yes") {
    Write-Host "Operation cancelled." -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 0
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Starting Move Operation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Create destination parent directory
Write-Host "[1/3] Creating destination directory..." -ForegroundColor Yellow
New-Item -Path $destParent -ItemType Directory -Force | Out-Null
Write-Host "✓ Created: $destParent" -ForegroundColor Green
Write-Host ""

# Move the directory
Write-Host "[2/3] Moving Cursor data to F drive..." -ForegroundColor Yellow
Write-Host "This may take several minutes for ~36 GB..." -ForegroundColor Gray
try {
    Move-Item -Path $sourceDir -Destination $destDir -Force
    Write-Host "✓ Successfully moved data to F drive" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Failed to move data!" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host ""

# Create symbolic link
Write-Host "[3/3] Creating symbolic link..." -ForegroundColor Yellow
try {
    New-Item -ItemType SymbolicLink -Path $sourceDir -Target $destDir -Force | Out-Null
    Write-Host "✓ Created symbolic link" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Failed to create symbolic link!" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Write-Host "Attempting to restore..." -ForegroundColor Yellow
    Move-Item -Path $destDir -Destination $sourceDir -Force
    Write-Host "Data has been moved back to C drive" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host ""

# Verify symbolic link
Write-Host "Verifying symbolic link..." -ForegroundColor Yellow
$link = Get-Item $sourceDir
if ($link.LinkType -eq "SymbolicLink" -and $link.Target -eq $destDir) {
    Write-Host "✓ Symbolic link verified successfully" -ForegroundColor Green
} else {
    Write-Host "WARNING: Link verification failed" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SUCCESS!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Cursor data has been moved to F drive." -ForegroundColor Green
Write-Host "You have freed up approximately $([math]::Round($size, 2)) GB on C drive." -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Open Cursor normally" -ForegroundColor White
Write-Host "2. Verify your AI chat history is still there" -ForegroundColor White
Write-Host "3. If everything works, you're done!" -ForegroundColor White
Write-Host ""
Write-Host "If something goes wrong, run: restore-cursor-to-c-drive.ps1" -ForegroundColor Yellow
Write-Host ""
Read-Host "Press Enter to exit"
