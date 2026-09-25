# PowerShell wrapper to reprocess matches that used fallback calculation.
# Runs scripts/reprocess-fallback-matches.ts against DATABASE_URL (from the environment, .env.local or .env).
# Usage: .\scripts\reprocess-fallback-matches.ps1 [-MatchId <id>] [-Limit 100] [-DryRun]

param(
    [string]$MatchId,
    [int]$Limit = 100,
    [switch]$DryRun
)

$scriptArgs = @('tsx', 'scripts/reprocess-fallback-matches.ts', '--limit', $Limit.ToString())

if ($MatchId) {
    $scriptArgs += @('--match-id', $MatchId)
}

if ($DryRun) {
    $scriptArgs += '--dry-run'
}

& npx @scriptArgs
exit $LASTEXITCODE
