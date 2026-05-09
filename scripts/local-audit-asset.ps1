param(
  [Parameter(Mandatory = $true)]
  [string]$Isin,
  [string]$BaseUrl = "http://localhost:3000",
  [int]$Limit = 100,
  [switch]$IncludeActivities,
  [switch]$IncludeAmounts,
  [switch]$IncludePortfolioNames,
  [switch]$IncludeActivityIds
)

$ErrorActionPreference = "Stop"

function Write-Section {
  param(
    [string]$Title,
    [object]$Value
  )

  Write-Host ""
  Write-Host "=== $Title ==="
  $Value | ConvertTo-Json -Depth 30
}

function Invoke-AuditRequest {
  param([string]$Url)

  try {
    return Invoke-RestMethod -Method Get -Uri $Url -ErrorAction Stop
  } catch {
    Write-Error @"
Global Asset asset audit request failed.

URL: $Url

Check:
- npm run dev is running
- ENABLE_GLOBAL_ASSET_AUDIT_ROUTES=true is set in .env.local
- Parqet is connected locally
- the browser/local session has valid Parqet cookies
- the ISIN exists in the authorized Parqet portfolios

Original error:
$($_.Exception.Message)
"@
  }
}

$normalizedIsin = $Isin.Trim().ToUpperInvariant()
if ([string]::IsNullOrWhiteSpace($normalizedIsin)) {
  throw "-Isin must not be empty."
}

if ($Limit -lt 1) {
  $Limit = 100
}

$normalizedBaseUrl = $BaseUrl.TrimEnd("/")
$queryParts = @(
  "isin=$([System.Uri]::EscapeDataString($normalizedIsin))",
  "includeAssets=true",
  "includeActivities=$($IncludeActivities.IsPresent.ToString().ToLowerInvariant())",
  "includeAmounts=$($IncludeAmounts.IsPresent.ToString().ToLowerInvariant())",
  "includePortfolioNames=$($IncludePortfolioNames.IsPresent.ToString().ToLowerInvariant())",
  "includeActivityIds=$($IncludeActivityIds.IsPresent.ToString().ToLowerInvariant())",
  "limit=$Limit"
)
$query = $queryParts -join "&"
$url = "$normalizedBaseUrl/api/parqet/global-assets/audit?$query"
$report = Invoke-AuditRequest -Url $url

Write-Host "Global Asset audit for ISIN $normalizedIsin"
Write-Host "URL: $url"
Write-Host "Note: Defaults are redacted. Do not commit real-data output."

Write-Section -Title "sources" -Value $report.sources
Write-Section -Title "normalization.summary" -Value $report.normalization.summary
Write-Section -Title "aggregation.summary" -Value $report.aggregation.summary
Write-Section -Title "summary" -Value $report.summary
Write-Section -Title "privacy" -Value $report.privacy
Write-Section -Title "warnings" -Value $report.warnings
Write-Section -Title "aggregation.assets" -Value $report.aggregation.assets
Write-Section -Title "nextSteps" -Value $report.nextSteps
