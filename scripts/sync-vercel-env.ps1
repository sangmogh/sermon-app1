# Vercel Production에 .env 의 GEMINI 변수 등록 (먼저: npx vercel login)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root ".env"

if (-not (Test-Path $envFile)) {
  Write-Error ".env 파일이 없습니다."
}

Push-Location $root
try {
  foreach ($name in @("GEMINI_API_KEY", "GEMINI_MODEL")) {
    $line = Get-Content $envFile | Where-Object { $_ -match "^$name=" } | Select-Object -First 1
    if (-not $line) { continue }
    $value = $line -replace "^$name=", ""
    Write-Host "Adding $name to Vercel Production..."
    $value | npx vercel env add $name production --force
  }
  Write-Host "Done. Run: npx vercel deploy --prod"
} finally {
  Pop-Location
}
