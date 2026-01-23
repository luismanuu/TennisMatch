# PowerShell script to reprocess matches that used fallback calculation
# Usage: .\scripts\reprocess-fallback-matches.ps1 -ClerkId "your_clerk_id" [options]

param(
    [Parameter(Mandatory=$true)]
    [string]$ClerkId,
    
    [string]$MatchId,
    [int]$Limit = 100,
    [switch]$DryRun,
    [string]$BaseUrl = "http://localhost:3000"
)

# Build query parameters
$queryParams = @{
    clerk_id = $ClerkId
    limit = $Limit.ToString()
}

if ($MatchId) {
    $queryParams.match_id = $MatchId
}

if ($DryRun) {
    $queryParams.dry_run = "true"
}

# Build URL
$queryString = ($queryParams.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join "&"
$url = "$BaseUrl/api/admin/matches/reprocess-fallback?$queryString"

Write-Host "🔄 Reprocessing fallback matches..." -ForegroundColor Cyan
Write-Host "   Clerk ID: $ClerkId" -ForegroundColor Gray
if ($MatchId) { Write-Host "   Match ID: $MatchId" -ForegroundColor Gray }
Write-Host "   Limit: $Limit" -ForegroundColor Gray
Write-Host "   Dry Run: $(if ($DryRun) { 'YES' } else { 'NO' })" -ForegroundColor Gray
Write-Host "   Base URL: $BaseUrl" -ForegroundColor Gray
Write-Host ""
Write-Host "📡 Calling: $($url.Replace($ClerkId, '***'))" -ForegroundColor Yellow
Write-Host ""

try {
    $response = Invoke-WebRequest -Uri $url -Method POST -ContentType "application/json" -ErrorAction Stop
    
    $result = $response.Content | ConvertFrom-Json
    
    Write-Host "✅ Result:" -ForegroundColor Green
    Write-Host ($result | ConvertTo-Json -Depth 10) -ForegroundColor White
    
    if ($result.results -and $result.results.Count -gt 0) {
        Write-Host ""
        Write-Host "📊 Detailed Results:" -ForegroundColor Cyan
        foreach ($r in $result.results) {
            $icon = switch ($r.status) {
                "success" { "✅" }
                "error" { "❌" }
                default { "⏭️" }
            }
            $color = switch ($r.status) {
                "success" { "Green" }
                "error" { "Red" }
                default { "Yellow" }
            }
            Write-Host "   $icon Match $($r.match_id): $($r.status) - $($r.message)" -ForegroundColor $color
            if ($r.error) {
                Write-Host "      Error: $($r.error)" -ForegroundColor Red
            }
        }
    }
    
    Write-Host ""
    Write-Host "✨ Done!" -ForegroundColor Green
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response: $responseBody" -ForegroundColor Red
    }
    exit 1
}
