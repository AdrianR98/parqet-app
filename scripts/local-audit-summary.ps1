param(
  [string]$BaseUrl = "http://localhost:3000",
  [int]$Limit = 5,
  [string]$CookieHeader = ""
)

$ErrorActionPreference = "Stop"

function Write-Section {
  param(
    [string]$Title,
    [object]$Value
  )

  Write-Host ""
  Write-Host "=== $Title ==="
  $Value | ConvertTo-Json -Depth 20
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
Global Asset audit request failed.

URL: $Url

Check:
- npm run dev is running
- ENABLE_GLOBAL_ASSET_AUDIT_ROUTES=true is set in .env.local
- Parqet is connected locally
- terminal requests do not share browser cookies automatically
- pass a local-only Cookie header with -CookieHeader if the browser route works but this script returns 401

Example:
npm run audit:summary -- -CookieHeader "parqet_access_token=...; parqet_refresh_token=..."

Do not commit, screenshot or share cookie values.

Original error:
$($_.Exception.Message)
"@
  }
}

$normalizedBaseUrl = $BaseUrl.TrimEnd("/")
if ($Limit -lt 1) {
  $Limit = 5
}

$query = "includeAssets=false&includeActivities=false&limit=$Limit"
$url = "$normalizedBaseUrl/api/parqet/global-assets/audit?$query"
$report = Invoke-AuditRequest -Url $url -CookieHeader $CookieHeader

Write-Host "Global Asset audit summary"
Write-Host "URL: $url"
Write-Host "Note: Output is redacted by the local audit route. Do not commit real-data output."
if (-not [string]::IsNullOrWhiteSpace($CookieHeader)) {
  Write-Host "Cookie header: provided, not printed"
}

Write-Section -Title "sources" -Value $report.sources
Write-Section -Title "normalization.summary" -Value $report.normalization.summary
Write-Section -Title "aggregation.summary" -Value $report.aggregation.summary
Write-Section -Title "summary" -Value $report.summary
Write-Section -Title "privacy" -Value $report.privacy
Write-Section -Title "warningsTruncated" -Value $report.warningsTruncated
Write-Section -Title "nextSteps" -Value $report.nextSteps
