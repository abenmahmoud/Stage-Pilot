[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$ClassesExportPath,

  [string]$TeachersExportPath,

  [ValidateRange(1, 60)]
  [int]$EveryMinutes = 5,

  [string]$Endpoint = 'https://lycee-blaise-cendrars-sevran.fr/api/depot/edt'
)

$ErrorActionPreference = 'Stop'
$allowedExtensions = @('.pdf', '.csv', '.xlsx')

function Assert-ExportPath([string]$Path, [string]$Label) {
  if (-not [IO.Path]::IsPathRooted($Path)) { throw "$Label doit être un chemin absolu." }
  if ($allowedExtensions -notcontains [IO.Path]::GetExtension($Path).ToLowerInvariant()) {
    throw "$Label doit viser un fichier PDF, CSV ou Excel (.xlsx)."
  }
}

Assert-ExportPath $ClassesExportPath 'Le fichier des classes'
if ($TeachersExportPath) { Assert-ExportPath $TeachersExportPath 'Le fichier des professeurs' }

$sourceClient = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\scripts\sync-edt-client.mjs'))
$sourceInvoker = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'Invoke-LyceeGestEdtSync.ps1'))
if (-not (Test-Path -LiteralPath $sourceClient -PathType Leaf)) { throw 'Client Node introuvable dans le dépôt.' }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js 20 ou supérieur doit être installé.' }

$installDirectory = Join-Path $env:LOCALAPPDATA 'LyceeGest\EdtSync'
New-Item -ItemType Directory -Force -Path $installDirectory | Out-Null
Copy-Item -LiteralPath $sourceClient -Destination (Join-Path $installDirectory 'sync-edt-client.mjs') -Force
Copy-Item -LiteralPath $sourceInvoker -Destination (Join-Path $installDirectory 'Invoke-LyceeGestEdtSync.ps1') -Force

$sources = @(
  [ordered]@{
    path = [IO.Path]::GetFullPath($ClassesExportPath)
    sourceKind = 'classes'
    title = 'Synchronisation automatique EDT — classes'
  }
)
if ($TeachersExportPath) {
  $sources += [ordered]@{
    path = [IO.Path]::GetFullPath($TeachersExportPath)
    sourceKind = 'teachers'
    title = 'Synchronisation automatique EDT — professeurs'
  }
}

$config = [ordered]@{
  endpoint = $Endpoint
  minimumAgeSeconds = 60
  freshDays = 2
  statePath = (Join-Path $installDirectory 'edt-sync-state.json')
  sources = $sources
}
$config | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $installDirectory 'edt-sync-config.json') -Encoding UTF8

$token = Read-Host 'Collez le jeton du Dépôt Lycée (il sera chiffré pour votre compte Windows)' -AsSecureString
$token | ConvertFrom-SecureString | Set-Content -LiteralPath (Join-Path $installDirectory 'depot-token.dpapi') -Encoding ASCII

$taskName = 'LyceeGest - Synchronisation EDT'
$invoker = Join-Path $installDirectory 'Invoke-LyceeGestEdtSync.ps1'
$taskCommand = "powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$invoker`" -InstallDirectory `"$installDirectory`""
& schtasks.exe /Create /F /SC MINUTE /MO $EveryMinutes /TN $taskName /TR $taskCommand | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'La tâche planifiée Windows n’a pas pu être créée.' }

Write-Host "Synchronisation installée dans $installDirectory"
Write-Host "Tâche planifiée : $taskName (toutes les $EveryMinutes minutes)"
Write-Host 'Le premier envoi restera en attente de contrôle et d’activation dans LyceeGest.'
