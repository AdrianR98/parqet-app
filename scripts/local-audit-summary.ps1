param(
  [string]$BaseUrl = "http://localhost:3000",
  [int]$Limit = 5
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
  param([string]$Url)

  try {
    return Invoke-RestMethod -Method Get -Uri $Url -ErrorAction Stop
  } catch {
    Write-Error @"
Global Asset audit request failed.

URL: $Url

Check:
- npm run dev is running
- ENABLE_GLOBAL_ASSET_AUDIT_ROUTES=true is set in .env.local
- Parqet is connected locally
- the browser/local session has valid Parqet cookies

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
$report = Invoke-AuditRequest -Url $url

Write-Host "Global Asset audit summary"
Write-Host "URL: $url"
Write-Host "Note: Output is redacted by the local audit route. Do not commit real-data output."

Write-Section -Title "sources" -Value $report.sources
Write-Section -Title "normalization.summary" -Value $report.normalization.summary
Write-Section -Title "aggregation.summary" -Value $report.aggregation.summary
Write-Section -Title "summary" -Value $report.summary
Write-Section -Title "privacy" -Value $report.privacy
Write-Section -Title "warningsTruncated" -Value $report.warningsTruncated
Write-Section -Title "nextSteps" -Value $report.nextSteps
