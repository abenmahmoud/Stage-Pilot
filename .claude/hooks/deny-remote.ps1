$raw = [Console]::In.ReadToEnd()
try { $j = $raw | ConvertFrom-Json } catch { exit 0 }
$t = ''
if ($j.tool_input) {
  $t = @($j.tool_input.command, $j.tool_input.file_path, $j.tool_input.path, $j.tool_input.pattern) -join ' '
}
if ([string]::IsNullOrWhiteSpace($t)) { exit 0 }
$patterns = @(
  'git\s+push', 'git\s+remote\s+set-url', 'npm\s+publish',
  'vercel', 'DONNEES-PRIVEES', 'ssh\s', 'scp\s',
  'supabase\s+link', 'supabase\s+projects', 'supabase\s+branches',
  'supabase\s+db\s+push', 'supabase\s+db\s+remote', '--linked',
  'db\s+push', 'supabase\.co', 'pooler\.supabase',
  'hostinger', 'brevo', 'Send-MailMessage', 'smtp',
  'gh\s+pr', 'gh\s+release', 'gh\s+api',
  'Invoke-WebRequest', 'Invoke-RestMethod', 'curl\s+http', 'wget\s+http'
)
foreach ($pat in $patterns) {
  if ($t -imatch $pat) {
    [Console]::Error.WriteLine("BARRIERE DE NUIT : commande bloquee (motif '$pat'). Aucune action distante, aucun envoi, aucune donnee privee. Poursuis en local ou arrete-toi et ecris ton compte rendu.")
    exit 2
  }
}
exit 0