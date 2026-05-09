param(
  [Parameter(Mandatory = $true)]
  [string]$Isin,
  [string]$BaseUrl = "http://localhost:3000",
  [int]$Limit = 100,
  [string]$CookieHeader = "",
  [switch]$UseCookieJar,
  [string]$CookieJarPath = ".local/parqet-audit-cookies.txt",
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

function Resolve-LocalPath {
  param([string]$Path)

  if ([System.IO.Path]::IsPathRooted($Path)) {
    return $Path
  }

  return Join-Path (Get-Location) $Path
}

function Initialize-CookieJarFile {
  param([string]$ResolvedCookieJarPath)

  $directory = Split-Path -Parent $ResolvedCookieJarPath
  if (-not [string]::IsNullOrWhiteSpace($directory) -and -not (Test-Path $directory)) {
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
  }
}

function Invoke-AuditRequestWithCurl {
  param(
    [string]$Url,
    [string]$CookieHeader,
    [bool]$UseCookieJar,
    [string]$ResolvedCookieJarPath
  )

  if ($UseCookieJar) {
    Initialize-CookieJarFile -ResolvedCookieJarPath $ResolvedCookieJarPath

    if (-not [string]::IsNullOrWhiteSpace($CookieHeader)) {
      $response = & curl.exe -sS -H "Cookie: $CookieHeader" -c $ResolvedCookieJarPath $Url
    } elseif (Test-Path $ResolvedCookieJarPath) {
      $response = & curl.exe -sS -b $ResolvedCookieJarPath -c $ResolvedCookieJarPath $Url
    } else {
      throw "Cookie jar not found. Run once with -CookieHeader `$cookie -UseCookieJar after browser OAuth."
    }
  } else {
    $response = & curl.exe -sS $Url -H "Cookie: $CookieHeader"
  }

  if ($LASTEXITCODE -ne 0) {
    throw "curl.exe failed with exit code $LASTEXITCODE."
  }

  try {
    return $response | ConvertFrom-Json
  } catch {
    throw "curl.exe returned a non-JSON response. Response starts with: $($response.Substring(0, [Math]::Min(300, $response.Length)))"
  }
}

function Invoke-AuditRequest {
  param(
    [string]$Url,
    [string]$CookieHeader,
    [bool]$UseCookieJar,
    [string]$ResolvedCookieJarPath
  )

  try {
    if ($UseCookieJar -or -not [string]::IsNullOrWhiteSpace($CookieHeader)) {
      return Invoke-AuditRequestWithCurl `
        -Url $Url `
        -CookieHeader $CookieHeader `
        -UseCookieJar $UseCookieJar `
        -ResolvedCookieJarPath $ResolvedCookieJarPath
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
- recommended: seed a local cookie jar once with -CookieHeader `$cookie -UseCookieJar, then use -UseCookieJar only
- Cookie-header and cookie-jar requests use curl.exe on Windows because Invoke-RestMethod can mishandle this local Cookie scenario
- the ISIN exists in the authorized Parqet portfolios

Examples:
Initial bootstrap:
npm run audit:asset -- -Isin US83444M1018 -CookieHeader "parqet_access_token=...; parqet_refresh_token=..." -UseCookieJar

Later calls:
npm run audit:asset -- -Isin US83444M1018 -UseCookieJar

Do not commit, screenshot or share cookie values or .local cookie jar files.

Original error:
$($_.Exception.Message)
"@
  }
}

function Write-AuthNoteIfNeeded {
  param([object]$Report)

  $note = $Report.sources.note
  if ($note -eq "Access token expired and refresh failed.") {
    Write-Host ""
    Write-Warning "Parqet session refresh failed. Reauthorize once in the browser via /api/auth/start, then reseed the local cookie jar with -CookieHeader `$cookie -UseCookieJar."
  }

  if ($note -like "*rate limit*") {
    Write-Host ""
    Write-Warning "Parqet rate limit reached. Stop local audit calls until the retry window has passed."
  }
}

function Write-DiagnosticsIfPresent {
  param([object]$Report)

  if ($null -ne $Report.diagnostic) {
    Write-Section -Title "diagnostic" -Value $Report.diagnostic
  }

  if ($null -ne $Report.error) {
    Write-Section -Title "error" -Value $Report.error
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
$resolvedCookieJarPath = Resolve-LocalPath -Path $CookieJarPath
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
$report = Invoke-AuditRequest `
  -Url $url `
  -CookieHeader $CookieHeader `
  -UseCookieJar $UseCookieJar.IsPresent `
  -ResolvedCookieJarPath $resolvedCookieJarPath

Write-Host "Global Asset audit for ISIN $normalizedIsin"
Write-Host "URL: $url"
Write-Host "Note: Defaults are redacted. Do not commit real-data output."
if ($UseCookieJar.IsPresent) {
  Write-Host "Cookie jar: enabled at $CookieJarPath; values not printed"
}
if (-not [string]::IsNullOrWhiteSpace($CookieHeader)) {
  Write-Host "Cookie header: provided, not printed; request used curl.exe"
}

Write-AuthNoteIfNeeded -Report $report
Write-DiagnosticsIfPresent -Report $report
Write-Section -Title "sources" -Value $report.sources
Write-Section -Title "normalization.summary" -Value $report.normalization.summary
Write-Section -Title "aggregation.summary" -Value $report.aggregation.summary
Write-Section -Title "summary" -Value $report.summary
Write-Section -Title "privacy" -Value $report.privacy
Write-Section -Title "warnings" -Value $report.warnings
Write-Section -Title "aggregation.assets" -Value $report.aggregation.assets
Write-Section -Title "nextSteps" -Value $report.nextSteps
