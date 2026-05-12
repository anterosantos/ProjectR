# Pre-dev hook: Verify Docker Desktop is running before starting dev server
# Used by: npm run predev (called via "predev" in package.json)
# Story: 1.2 (Code Review, Patch #13)
# Windows PowerShell version

try {
    $dockerInfo = & docker info 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Docker not running"
    }
    Write-Host "✅ Docker is running. Ready to start dev server." -ForegroundColor Green
    exit 0
} catch {
    Write-Host "❌ Docker Desktop is not running." -ForegroundColor Red
    Write-Host ""
    Write-Host "Local development requires Docker for the Supabase stack."
    Write-Host "Please start Docker Desktop and try again."
    Write-Host ""
    Write-Host "   Windows: Open the Docker Desktop application"
    Write-Host ""
    exit 1
}
