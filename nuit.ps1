param([int]$From = 1)
# Lance la nuit de travail Claude Code, un lot par session fraiche.
$ErrorActionPreference = 'Continue'
Set-Location -LiteralPath $PSScriptRoot
$logDir = Join-Path $PSScriptRoot 'docs\operations\night-logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$stopFile = Join-Path $PSScriptRoot 'STOP-NUIT.txt'
$lockFile = Join-Path $PSScriptRoot '.nuit.lock'

if (Test-Path $lockFile) {
  $age = (Get-Date) - (Get-Item $lockFile).LastWriteTime
  if ($age.TotalHours -lt 6) { Write-Host "Une nuit tourne deja (.nuit.lock, $([int]$age.TotalMinutes) min). Abandon." -ForegroundColor Red; exit 1 }
}
"$PID $stamp" | Set-Content -LiteralPath $lockFile

$lots = @(
  @{ n = 1; t = 'Rejeu des 94 migrations' },
  @{ n = 2; t = 'Repetition promotion production 3 vers 94' },
  @{ n = 3; t = 'Etat editorial des 28 contenus' },
  @{ n = 4; t = 'Redirections, liens, responsive' },
  @{ n = 5; t = 'Dossier de bascule vendredi' }
)

function Invoke-Lot([int]$n, [string]$titre) {
  $log = Join-Path $logDir "$stamp-LOT$n.log"
  $rapport = Join-Path $logDir "LOT$n.md"
  $avant = if (Test-Path $rapport) { (Get-Item $rapport).LastWriteTime } else { [datetime]::MinValue }
  $prompt = "Execute UNIQUEMENT le LOT $n du fichier docs/operations/NIGHT_PLAN_2026-09-03.md. " +
            "Respecte strictement CLAUDE.md et les regles communes du plan. " +
            "Ne lis pas specs/project-memory.md en entier : utilise grep sur la section utile. " +
            "Termine OBLIGATOIREMENT en ecrivant ton compte rendu dans docs/operations/night-logs/LOT$n.md " +
            "puis fais un commit local. Ne fais rien d'autre."
  Write-Host "=== LOT $n : $titre === $(Get-Date -Format 'HH:mm:ss')" -ForegroundColor Cyan
  & claude -p $prompt --model sonnet --permission-mode bypassPermissions *>&1 | Tee-Object -FilePath $log
  # succes = le compte rendu du lot a bien ete (re)ecrit
  if (Test-Path $rapport) { return ((Get-Item $rapport).LastWriteTime -gt $avant) }
  return $false
}

$echec = $null
foreach ($l in $lots) {
  if ($l.n -lt $From) { continue }
  if (Test-Path $stopFile) { Write-Host 'STOP-NUIT.txt present : arret demande.' -ForegroundColor Yellow; break }
  if (-not (Invoke-Lot $l.n $l.t)) {
    Write-Host "LOT $($l.n) : pas de compte rendu ecrit. Passage a la cloture." -ForegroundColor Yellow
    $echec = $l.n; break
  }
  Write-Host "LOT $($l.n) OK." -ForegroundColor Green
}

$log6 = Join-Path $logDir "$stamp-LOT6.log"
$ctx = if ($echec) { "Le LOT $echec n'a pas abouti : documente l'erreur exacte sans la masquer." } else { "Tous les lots demandes sont passes." }
$prompt6 = "Execute UNIQUEMENT le LOT 6 (cloture) du fichier docs/operations/NIGHT_PLAN_2026-09-03.md. " +
           "$ctx Respecte strictement CLAUDE.md. Ne declare prouve que ce qui l'est reellement."
Write-Host "=== LOT 6 : cloture === $(Get-Date -Format 'HH:mm:ss')" -ForegroundColor Cyan
& claude -p $prompt6 --model sonnet --permission-mode bypassPermissions *>&1 | Tee-Object -FilePath $log6

Remove-Item -LiteralPath $lockFile -ErrorAction SilentlyContinue
Write-Host ''
Write-Host "=== FIN $(Get-Date -Format 'HH:mm:ss') ===" -ForegroundColor Green
& git log --oneline -12