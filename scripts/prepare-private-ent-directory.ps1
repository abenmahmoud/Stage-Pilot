param(
  [Parameter(Mandatory = $true)]
  [string]$SourceZip,
  [Parameter(Mandatory = $true)]
  [string]$PrivateRoot,
  [Parameter(Mandatory = $true)]
  [string]$OutputCsv,
  [string]$ActiveFrom = "2026-09-01",
  [string]$ActiveUntil = "2027-08-31",
  [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.Security

$maxEntryBytes = 10MB
$requiredJsonFiles = @(
  "statut_eleves.json",
  "parents.json",
  "liens_parent_eleve.json"
)
$headers = @(
  "record_type",
  "person_ref",
  "person_type",
  "first_name",
  "last_name",
  "academic_email",
  "personal_email",
  "phone",
  "class_ref",
  "service_code",
  "active_from",
  "active_until",
  "subject_person_ref",
  "relationship_type",
  "object_ref",
  "valid_from",
  "valid_until"
)

function Resolve-PrivatePath([string]$Path, [string]$Root, [bool]$MustExist) {
  $resolvedRoot = [IO.Path]::GetFullPath($Root).TrimEnd('\') + '\'
  $resolvedPath = [IO.Path]::GetFullPath($Path)
  if (-not $resolvedPath.StartsWith($resolvedRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Le chemin doit rester dans le dossier privé."
  }
  if ($MustExist -and -not (Test-Path -LiteralPath $resolvedPath -PathType Leaf)) {
    throw "Le fichier source privé est introuvable."
  }
  return $resolvedPath
}

function Read-JsonEntry($Archive, [string]$FileName) {
  $entry = $Archive.Entries |
    Where-Object { [IO.Path]::GetFileName($_.FullName) -eq $FileName } |
    Select-Object -First 1
  if ($null -eq $entry -or $entry.Length -lt 2 -or $entry.Length -gt $maxEntryBytes) {
    throw "Le paquet privé est incomplet ou dépasse les limites."
  }
  $reader = [IO.StreamReader]::new($entry.Open(), [Text.Encoding]::UTF8, $true)
  try {
    $parsed = $reader.ReadToEnd() | ConvertFrom-Json
    return ,@($parsed)
  } finally {
    $reader.Dispose()
  }
}

function Text($Value) {
  if ($null -eq $Value) { return "" }
  return ([string]$Value).Trim()
}

function Normalized-Key($Value) {
  return (Text $Value).Normalize([Text.NormalizationForm]::FormKC).ToLowerInvariant()
}

function Valid-Email($Value) {
  $email = Text $Value
  if ($email.Length -gt 254 -or $email -notmatch '^[^\s@]+@[^\s@]+\.[^\s@]+$') {
    return ""
  }
  return $email.ToLowerInvariant()
}

function Read-Or-Create-Key([string]$KeyPath) {
  if (Test-Path -LiteralPath $KeyPath -PathType Leaf) {
    $protected = [IO.File]::ReadAllBytes($KeyPath)
    return [Security.Cryptography.ProtectedData]::Unprotect(
      $protected,
      $null,
      [Security.Cryptography.DataProtectionScope]::CurrentUser
    )
  }
  $key = [byte[]]::new(32)
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $rng.GetBytes($key)
  } finally {
    $rng.Dispose()
  }
  $protected = [Security.Cryptography.ProtectedData]::Protect(
    $key,
    $null,
    [Security.Cryptography.DataProtectionScope]::CurrentUser
  )
  [IO.File]::WriteAllBytes($KeyPath, $protected)
  return $key
}

function Opaque-Reference([string]$Prefix, [string]$Seed, [byte[]]$Key, [int]$Length = 24) {
  $hmac = [Security.Cryptography.HMACSHA256]::new($Key)
  try {
    $digest = $hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($Seed))
    $hex = ([BitConverter]::ToString($digest) -replace '-', '').Substring(0, $Length)
    return "$Prefix-$hex"
  } finally {
    $hmac.Dispose()
  }
}

function Directory-Row {
  param(
    [string]$RecordType,
    [string]$PersonRef = "",
    [string]$PersonType = "",
    [string]$FirstName = "",
    [string]$LastName = "",
    [string]$PersonalEmail = "",
    [string]$ClassRef = "",
    [string]$SubjectPersonRef = "",
    [string]$RelationshipType = "",
    [string]$ObjectRef = ""
  )
  return [pscustomobject][ordered]@{
    record_type = $RecordType
    person_ref = $PersonRef
    person_type = $PersonType
    first_name = $FirstName
    last_name = $LastName
    academic_email = ""
    personal_email = $PersonalEmail
    phone = ""
    class_ref = $ClassRef
    service_code = ""
    active_from = $(if ($RecordType -eq "person") { $ActiveFrom } else { "" })
    active_until = $(if ($RecordType -eq "person") { $ActiveUntil } else { "" })
    subject_person_ref = $SubjectPersonRef
    relationship_type = $RelationshipType
    object_ref = $ObjectRef
    valid_from = $(if ($RecordType -eq "relationship") { $ActiveFrom } else { "" })
    valid_until = $(if ($RecordType -eq "relationship") { $ActiveUntil } else { "" })
  }
}

$privateRootPath = [IO.Path]::GetFullPath($PrivateRoot)
if (-not (Test-Path -LiteralPath $privateRootPath -PathType Container)) {
  throw "Le dossier privé est introuvable."
}
$sourcePath = Resolve-PrivatePath $SourceZip $privateRootPath $true
$outputPath = Resolve-PrivatePath $OutputCsv $privateRootPath $false
if ((Test-Path -LiteralPath $outputPath) -and -not $Force) {
  throw "Le fichier normalisé existe déjà. Utilisez -Force pour le remplacer."
}

$outputDirectory = Split-Path -Parent $outputPath
[IO.Directory]::CreateDirectory($outputDirectory) | Out-Null
$keyPath = Join-Path $privateRootPath ".identity-reference-key.dpapi"
$key = Read-Or-Create-Key $keyPath

$archive = [IO.Compression.ZipFile]::OpenRead($sourcePath)
try {
  foreach ($required in $requiredJsonFiles) {
    if (-not ($archive.Entries | Where-Object { [IO.Path]::GetFileName($_.FullName) -eq $required })) {
      throw "Le paquet privé ne contient pas tous les fichiers requis."
    }
  }
  $students = Read-JsonEntry $archive "statut_eleves.json"
  $guardians = Read-JsonEntry $archive "parents.json"
  $links = Read-JsonEntry $archive "liens_parent_eleve.json"
} finally {
  $archive.Dispose()
}

if ($students.Count -gt 10000 -or $guardians.Count -gt 10000 -or $links.Count -gt 25000) {
  throw "Le paquet privé dépasse les limites du pilote."
}

$rows = [Collections.Generic.List[object]]::new()
$studentByIdentifier = @{}
$guardianByIdentifier = @{}
$seenPersonRefs = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
$studentEmailCount = 0
$guardianEmailCount = 0
$studentClassCount = 0

foreach ($student in $students) {
  $identifier = Normalized-Key $student.identifiant
  $seed = if ($identifier) {
    "student|identifier|$identifier"
  } else {
    "student|no-account|$(Normalized-Key $student.nom)|$(Normalized-Key $student.prenom)|$(Normalized-Key $student.date_naissance)|$(Normalized-Key $student.classe)"
  }
  $personRef = Opaque-Reference "STU" $seed $key
  if (-not $seenPersonRefs.Add($personRef)) {
    throw "Le répertoire contient deux élèves impossibles à distinguer."
  }
  if ($identifier) { $studentByIdentifier[$identifier] = $personRef }
  $classValue = Normalized-Key $student.classe
  $classRef = if ($classValue) { Opaque-Reference "CLASS" "class|$classValue" $key 16 } else { "" }
  $email = Valid-Email $student.email
  if ($email) { $studentEmailCount += 1 }
  if ($classRef) { $studentClassCount += 1 }
  $rows.Add((Directory-Row -RecordType "person" -PersonRef $personRef -PersonType "student" -FirstName (Text $student.prenom) -LastName (Text $student.nom) -PersonalEmail $email -ClassRef $classRef))
  if ($classRef) {
    $rows.Add((Directory-Row -RecordType "relationship" -SubjectPersonRef $personRef -RelationshipType "member_of" -ObjectRef $classRef))
  }
}

foreach ($guardian in $guardians) {
  $identifier = Normalized-Key $guardian.ident
  if (-not $identifier) { continue }
  $personRef = Opaque-Reference "GUA" "guardian|identifier|$identifier" $key
  if (-not $seenPersonRefs.Add($personRef)) {
    throw "Le répertoire contient deux responsables impossibles à distinguer."
  }
  $guardianByIdentifier[$identifier] = $personRef
  $email = Valid-Email $guardian.email
  if ($email) { $guardianEmailCount += 1 }
  $rows.Add((Directory-Row -RecordType "person" -PersonRef $personRef -PersonType "guardian" -FirstName (Text $guardian.pre) -LastName (Text $guardian.nom) -PersonalEmail $email))
}

$seenRelationships = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
$resolvedLinks = 0
$unresolvedLinks = 0
foreach ($link in $links) {
  $guardianIdentifier = Normalized-Key $link.parent
  $studentIdentifier = Normalized-Key $link.eleve
  $guardianRef = $guardianByIdentifier[$guardianIdentifier]
  $studentRef = $studentByIdentifier[$studentIdentifier]
  if (-not $guardianRef -or -not $studentRef) {
    $unresolvedLinks += 1
    continue
  }
  $relationshipKey = "$guardianRef|guardian_of|$studentRef"
  if ($seenRelationships.Add($relationshipKey)) {
    $rows.Add((Directory-Row -RecordType "relationship" -SubjectPersonRef $guardianRef -RelationshipType "guardian_of" -ObjectRef $studentRef))
  }
  $resolvedLinks += 1
}

$csv = $rows | Select-Object $headers | ConvertTo-Csv -NoTypeInformation
[IO.File]::WriteAllLines($outputPath, $csv, [Text.UTF8Encoding]::new($false))

$secretRowsExcluded = @($students | Where-Object { -not [string]::IsNullOrWhiteSpace((Text $_.code_premiere_connexion)) }).Count +
  @($guardians | Where-Object { -not [string]::IsNullOrWhiteSpace((Text $_.pw)) }).Count
$report = [ordered]@{
  generatedAt = [DateTimeOffset]::UtcNow.ToString("o")
  status = "inactive_local_test"
  studentCount = $students.Count
  guardianCount = $guardianByIdentifier.Count
  personCount = $students.Count + $guardianByIdentifier.Count
  studentEmailCount = $studentEmailCount
  guardianEmailCount = $guardianEmailCount
  studentClassCount = $studentClassCount
  guardianStudentRelationCount = $seenRelationships.Count
  sourceLinkCount = $links.Count
  resolvedSourceLinkCount = $resolvedLinks
  unresolvedSourceLinkCount = $unresolvedLinks
  outputRowCount = $rows.Count
  secretRowsExcluded = $secretRowsExcluded
  forbiddenFieldsWritten = 0
}
$reportPath = [IO.Path]::ChangeExtension($outputPath, ".report.json")
[IO.File]::WriteAllText(
  $reportPath,
  ($report | ConvertTo-Json -Depth 3),
  [Text.UTF8Encoding]::new($false)
)

[Array]::Clear($key, 0, $key.Length)
$report | ConvertTo-Json -Depth 3
