param(
  [Parameter(Mandatory = $true)]
  [string]$Isin,
  [string]$BaseUrl = "http://localhost:3000",
  [int]$Limit = 100,
  [string]$CookieHeader = "",
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
  param(
    [string]$Url,
    [string]$CookieHeader
  )

  try {
    $headers = @{}
    if (-not [string]::IsNullOrWhiteSpace($CookieHeader)) {
      $headers["Cookie"] = $CookieHeader
    }

    if ($headers.Count -gt 0) {
      return Invoke-RestMethod -Method Get -Uri $Url -Headers $headers -ErrorAction Stop
    }

    return Invoke-RestMethod -Method Get -Uri $Url -ErrorAction Stop
  } catch {
    Write-Error @"
Global Asset asset audit request failed.

URL: $Url

Check:
- npm run dev is running
- ENABLE_GLOBAL_ASSET_AUDIT_ROUTES=true is set in .env.local
- Parqet is connected locally
- terminal requests do not share browser cookies automatically
- pass a local-only Cookie header with -CookieHeader if the browser route works but this script returns 401
- the ISIN exists in the authorized Parqet portfolios

Example:
npm run audit:asset -- -Isin US83444M1018 -CookieHeader "parqet_access_token=...; parqet_refresh_token=..."

Do not commit, screenshot or share cookie values.

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
$report = Invoke-AuditRequest -Url $url -CookieHeader $CookieHeader

Write-Host "Global Asset audit for ISIN $normalizedIsin"
Write-Host "URL: $url"
Write-Host "Note: Defaults are redacted. Do not commit real-data output."
if (-not [string]::IsNullOrWhiteSpace($CookieHeader)) {
  Write-Host "Cookie header: provided, not printed"
}

Write-Section -Title "sources" -Value $report.sources
Write-Section -Title "normalization.summary" -Value $report.normalization.summary
Write-Section -Title "aggregation.summary" -Value $report.aggregation.summary
Write-Section -Title "summary" -Value $report.summary
Write-Section -Title "privacy" -Value $report.privacy
Write-Section -Title "warnings" -Value $report.warnings
Write-Section -Title "aggregation.assets" -Value $report.aggregation.assets
Write-Section -Title "nextSteps" -Value $report.nextSteps
