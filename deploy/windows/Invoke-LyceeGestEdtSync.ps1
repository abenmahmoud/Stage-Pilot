[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$InstallDirectory
)

$ErrorActionPreference = 'Stop'
$secretPath = Join-Path $InstallDirectory 'depot-token.dpapi'
$configPath = Join-Path $InstallDirectory 'edt-sync-config.json'
$clientPath = Join-Path $InstallDirectory 'sync-edt-client.mjs'

if (-not (Test-Path -LiteralPath $secretPath -PathType Leaf)) { throw 'Jeton de synchronisation introuvable.' }
if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) { throw 'Configuration de synchronisation introuvable.' }
if (-not (Test-Path -LiteralPath $clientPath -PathType Leaf)) { throw 'Client de synchronisation introuvable.' }

$secureToken = Get-Content -Raw -LiteralPath $secretPath | ConvertTo-SecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
try {
  $env:LYCEEGEST_DEPOT_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  & node $clientPath --config $configPath
  if ($LASTEXITCODE -ne 0) { throw "La synchronisation EDT a échoué (code $LASTEXITCODE)." }
}
finally {
  Remove-Item Env:LYCEEGEST_DEPOT_TOKEN -ErrorAction SilentlyContinue
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
}
