Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Assert-True([bool]$Condition, [string]$Message) {
  if (-not $Condition) { throw $Message }
}

$root = Join-Path ([IO.Path]::GetTempPath()) ("lyceegest-ent-fixture-" + [Guid]::NewGuid().ToString("N"))
$source = Join-Path $root "source"
$private = Join-Path $root "private"
$zipPath = Join-Path $private "fixture.zip"
$outputPath = Join-Path $private "normalized\directory.csv"

[IO.Directory]::CreateDirectory($source) | Out-Null
[IO.Directory]::CreateDirectory($private) | Out-Null

$students = @(
  [ordered]@{ classe = "TEST-A"; nom = "EleveTest"; prenom = "Alice"; date_naissance = "2010-01-01"; a_un_compte = $true; identifiant = "student-a"; code_premiere_connexion = "SecretStudentFixture"; classe_ent = "TEST-A"; statut = "code dispo"; email = "alice.student@example.test" },
  [ordered]@{ classe = "TEST-B"; nom = "EleveTest"; prenom = "Bob"; date_naissance = "2010-02-02"; a_un_compte = $false; identifiant = "student-b"; code_premiere_connexion = ""; classe_ent = ""; statut = "à créer"; email = "" }
)
$guardians = @(
  [ordered]@{ entid = "guardian-ent-a"; ident = "guardian-a"; nom = "ResponsableTest"; pre = "Camille"; classe = "TEST-A"; pw = "SecretGuardianFixture"; act = $true; email = "family@example.test" },
  [ordered]@{ entid = "guardian-ent-b"; ident = "guardian-b"; nom = "ResponsableTest"; pre = "Dominique"; classe = "TEST-B"; pw = ""; act = $true; email = "family@example.test" }
)
$links = @(
  [ordered]@{ parent = "guardian-a"; eleve = "student-a" },
  [ordered]@{ parent = "guardian-b"; eleve = "student-b" }
)
$entStudents = @(
  [ordered]@{ ident = "student-a"; email = "alice.student@example.test"; tel = "0611223344" },
  [ordered]@{ ident = "student-b"; email = ""; tel = "" }
)
$teachers = @(
  [ordered]@{ ident = "teacher-a"; nom = "ProfTest"; prenom = "Nora"; email = "nora.prof@ac-creteil.fr"; tel = "0611111111"; active = $true; code = "SecretTeacherFixture" },
  [ordered]@{ ident = "teacher-b"; nom = "ProfTest"; prenom = "Lina"; email = "nora.prof@ac-creteil.fr"; tel = ""; active = $true; code = "" },
  [ordered]@{ ident = "teacher-old"; nom = "ProfTest"; prenom = "Old"; email = "old.prof@ac-creteil.fr"; tel = ""; active = $false; code = "" }
)
$staffMembers = @(
  [ordered]@{ ident = "staff-a"; nom = "PersonnelTest"; prenom = "Sam"; email = "sam.staff@example.test"; tel = "0622222222"; active = $true; code = "SecretStaffFixture" }
)
$lessons = @(
  [ordered]@{ prof = "teacher-a"; classe = "TEST-A" },
  [ordered]@{ prof = "teacher-old"; classe = "TEST-B" }
)

[IO.File]::WriteAllText((Join-Path $source "statut_eleves.json"), ($students | ConvertTo-Json -Depth 4), [Text.UTF8Encoding]::new($false))
[IO.File]::WriteAllText((Join-Path $source "parents.json"), ($guardians | ConvertTo-Json -Depth 4), [Text.UTF8Encoding]::new($false))
[IO.File]::WriteAllText((Join-Path $source "liens_parent_eleve.json"), ($links | ConvertTo-Json -Depth 4), [Text.UTF8Encoding]::new($false))
[IO.File]::WriteAllText((Join-Path $source "eleves.json"), ($entStudents | ConvertTo-Json -Depth 4), [Text.UTF8Encoding]::new($false))
[IO.File]::WriteAllText((Join-Path $source "professeurs.json"), ($teachers | ConvertTo-Json -Depth 4), [Text.UTF8Encoding]::new($false))
[IO.File]::WriteAllText((Join-Path $source "personnels.json"), ($staffMembers | ConvertTo-Json -Depth 4), [Text.UTF8Encoding]::new($false))
[IO.File]::WriteAllText((Join-Path $source "enseignements.json"), ($lessons | ConvertTo-Json -Depth 4), [Text.UTF8Encoding]::new($false))
Compress-Archive -Path (Join-Path $source "*.json") -DestinationPath $zipPath

try {
  & (Join-Path $PSScriptRoot "prepare-private-ent-directory.ps1") `
    -SourceZip $zipPath `
    -PrivateRoot $private `
    -OutputCsv $outputPath | Out-Null

  $raw = [IO.File]::ReadAllText($outputPath)
  $rows = @(Import-Csv -LiteralPath $outputPath)
  $report = Get-Content -LiteralPath ([IO.Path]::ChangeExtension($outputPath, ".report.json")) -Raw | ConvertFrom-Json

  Assert-True ($rows.Count -eq 12) "Le nombre de lignes normalisées est incorrect."
  Assert-True ($report.personCount -eq 7) "Le nombre de personnes est incorrect."
  Assert-True ($report.guardianStudentRelationCount -eq 2) "Les relations parent-élève sont incorrectes."
  Assert-True ($report.teachingRelationCount -eq 1) "Les relations professeur-classe sont incorrectes."
  Assert-True ($report.teacherCount -eq 2 -and $report.staffMemberCount -eq 1) "Les personnels actifs sont incomplets."
  Assert-True ($report.duplicateAcademicEmailRowsExcluded -eq 2) "Les emails académiques partagés ne sont pas exclus."
  Assert-True ($report.secretRowsExcluded -eq 4) "Les secrets exclus ne sont pas comptés correctement."
  Assert-True ($report.forbiddenFieldsWritten -eq 0) "Un champ interdit a été écrit."
  Assert-True (-not $raw.Contains("SecretStudentFixture")) "Un code de première connexion a été copié."
  Assert-True (-not $raw.Contains("SecretGuardianFixture")) "Un mot de passe a été copié."
  Assert-True (-not $raw.Contains("SecretTeacherFixture")) "Un code enseignant a été copié."
  Assert-True (-not $raw.Contains("SecretStaffFixture")) "Un code personnel a été copié."
  Assert-True (-not $raw.Contains("date_naissance")) "La date de naissance ne doit pas être exportée."
  Assert-True (-not $raw.Contains('"pw"')) "La colonne mot de passe ne doit pas être exportée."
  Assert-True (-not $raw.Contains("code_premiere_connexion")) "La colonne code ne doit pas être exportée."
  Assert-True ((@($rows | Where-Object { $_.record_type -eq "person" })).Count -eq 7) "Les personnes sont incomplètes."
  Assert-True ((@($rows | Where-Object { $_.relationship_type -eq "guardian_of" })).Count -eq 2) "Les liens parent-élève sont incomplets."
  Assert-True ((@($rows | Where-Object { $_.relationship_type -eq "teaches" })).Count -eq 1) "Le lien professeur-classe est incomplet."

  Write-Output "private ENT directory preparation: 18/18 checks passed"
} finally {
  $resolvedRoot = [IO.Path]::GetFullPath($root)
  $tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
  if ($resolvedRoot.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase) -and
      [IO.Path]::GetFileName($resolvedRoot).StartsWith("lyceegest-ent-fixture-", [StringComparison]::Ordinal)) {
    Remove-Item -LiteralPath $resolvedRoot -Recurse -Force
  }
}
