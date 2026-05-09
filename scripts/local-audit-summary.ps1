param(
  [string]$BaseUrl = "http://localhost:3000",
  [int]$Limit = 5,
  [string]$CookieHeader = "",
  [switch]$UseCookieJar,
  [string]$CookieJarPath = ".local/parqet-audit-cookies.txt"
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

  if (-not (Test-Path $ResolvedCookieJarPath)) {
    @(
      "# Netscape HTTP Cookie File",
      "# Local Parqet audit cookies. Do not commit."
    ) | Set-Content -Path $ResolvedCookieJarPath -Encoding utf8
  }
}

function Seed-CookieJarFromHeader {
  param(
    [string]$CookieHeader,
    [string]$ResolvedCookieJarPath
  )

  if ([string]::IsNullOrWhiteSpace($CookieHeader)) {
    return
  }

  Initialize-CookieJarFile -ResolvedCookieJarPath $ResolvedCookieJarPath

  $lines = @(
    "# Netscape HTTP Cookie File",
    "# Local Parqet audit cookies. Do not commit."
  )

  foreach ($part in ($CookieHeader -split ";")) {
    $trimmed = $part.Trim()
    if ([string]::IsNullOrWhiteSpace($trimmed)) {
      continue
    }

    $separatorIndex = $trimmed.IndexOf("=")
    if ($separatorIndex -lt 1) {
      continue
    }

    $name = $trimmed.Substring(0, $separatorIndex).Trim()
    $value = $trimmed.Substring($separatorIndex + 1)
    if ([string]::IsNullOrWhiteSpace($name)) {
      continue
    }

    $lines += "localhost`tFALSE`t/`tFALSE`t0`t$name`t$value"
  }

  $lines | Set-Content -Path $ResolvedCookieJarPath -Encoding ascii
}

function Invoke-AuditRequestWithCurl {
  param(
    [string]$Url,
    [string]$CookieHeader,
    [bool]$UseCookieJar,
    [string]$ResolvedCookieJarPath
  )

  if ($UseCookieJar) {
    if (-not [string]::IsNullOrWhiteSpace($CookieHeader)) {
      Seed-CookieJarFromHeader -CookieHeader $CookieHeader -ResolvedCookieJarPath $ResolvedCookieJarPath
    } elseif (-not (Test-Path $ResolvedCookieJarPath)) {
      throw "Cookie jar not found. Run once with -CookieHeader `$cookie -UseCookieJar after browser OAuth."
    }

    $response = & curl.exe -sS -b $ResolvedCookieJarPath -c $ResolvedCookieJarPath $Url
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
Global Asset audit request failed.

URL: $Url

Check:
- npm run dev is running
- ENABLE_GLOBAL_ASSET_AUDIT_ROUTES=true is set in .env.local
- Parqet is connected locally
- terminal requests do not share browser cookies automatically
- recommended: seed a local cookie jar once with -CookieHeader `$cookie -UseCookieJar, then use -UseCookieJar only
- Cookie-header and cookie-jar requests use curl.exe on Windows because Invoke-RestMethod can mishandle this local Cookie scenario

Examples:
Initial bootstrap:
npm run audit:summary -- -CookieHeader "parqet_access_token=...; parqet_refresh_token=..." -UseCookieJar

Later calls:
npm run audit:summary -- -UseCookieJar

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
}

$normalizedBaseUrl = $BaseUrl.TrimEnd("/")
if ($Limit -lt 1) {
  $Limit = 5
}

$resolvedCookieJarPath = Resolve-LocalPath -Path $CookieJarPath
$query = "includeAssets=false&includeActivities=false&limit=$Limit"
$url = "$normalizedBaseUrl/api/parqet/global-assets/audit?$query"
$report = Invoke-AuditRequest `
  -Url $url `
  -CookieHeader $CookieHeader `
  -UseCookieJar $UseCookieJar.IsPresent `
  -ResolvedCookieJarPath $resolvedCookieJarPath

Write-Host "Global Asset audit summary"
Write-Host "URL: $url"
Write-Host "Note: Output is redacted by the local audit route. Do not commit real-data output."
if ($UseCookieJar.IsPresent) {
  Write-Host "Cookie jar: enabled at $CookieJarPath; values not printed"
}
if (-not [string]::IsNullOrWhiteSpace($CookieHeader)) {
  Write-Host "Cookie header: provided, not printed; request used curl.exe"
}

Write-AuthNoteIfNeeded -Report $report
Write-Section -Title "sources" -Value $report.sources
Write-Section -Title "normalization.summary" -Value $report.normalization.summary
Write-Section -Title "aggregation.summary" -Value $report.aggregation.summary
Write-Section -Title "summary" -Value $report.summary
Write-Section -Title "privacy" -Value $report.privacy
Write-Section -Title "warningsTruncated" -Value $report.warningsTruncated
Write-Section -Title "nextSteps" -Value $report.nextSteps
