[CmdletBinding()]
param(
    [ValidateRange(2, 30)]
    [int]$TimeoutSeconds = 8,

    [switch]$Json
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$endpoints = @(
    [pscustomobject]@{ Service = 'Claude'; Host = 'claude.ai'; Required = $true }
    [pscustomobject]@{ Service = 'Claude'; Host = 'claude.com'; Required = $true }
    [pscustomobject]@{ Service = 'Claude'; Host = 'api.anthropic.com'; Required = $true }
    [pscustomobject]@{ Service = 'Claude'; Host = 'platform.claude.com'; Required = $true }
    [pscustomobject]@{ Service = 'Claude'; Host = 'mcp-proxy.anthropic.com'; Required = $true }
    [pscustomobject]@{ Service = 'Claude'; Host = 'downloads.claude.ai'; Required = $true }
    [pscustomobject]@{ Service = 'Claude'; Host = 'code.claude.com'; Required = $true }

    [pscustomobject]@{ Service = 'OpenAI'; Host = 'chatgpt.com'; Required = $true }
    [pscustomobject]@{ Service = 'OpenAI'; Host = 'auth.openai.com'; Required = $true }
    [pscustomobject]@{ Service = 'OpenAI'; Host = 'auth0.openai.com'; Required = $true }
    [pscustomobject]@{ Service = 'OpenAI'; Host = 'setup.auth.openai.com'; Required = $true }
    [pscustomobject]@{ Service = 'OpenAI'; Host = 'api.openai.com'; Required = $true }
    [pscustomobject]@{ Service = 'OpenAI'; Host = 'ws.chatgpt.com'; Required = $true }
    [pscustomobject]@{ Service = 'OpenAI'; Host = 'desktop.chat.openai.com'; Required = $false }
    [pscustomobject]@{ Service = 'OpenAI'; Host = 'cdn.oaistatic.com'; Required = $true }
    [pscustomobject]@{ Service = 'OpenAI'; Host = 'files.oaiusercontent.com'; Required = $true }

    [pscustomobject]@{ Service = 'Kimi'; Host = 'www.kimi.com'; Required = $true }
    [pscustomobject]@{ Service = 'Kimi'; Host = 'auth.kimi.com'; Required = $true }
    [pscustomobject]@{ Service = 'Kimi'; Host = 'api.kimi.com'; Required = $true }
    [pscustomobject]@{ Service = 'Kimi'; Host = 'agent-gw.kimi.com'; Required = $true }
    [pscustomobject]@{ Service = 'Kimi'; Host = 'code.kimi.com'; Required = $true }

    [pscustomobject]@{ Service = 'Developpement'; Host = 'github.com'; Required = $true }
    [pscustomobject]@{ Service = 'Developpement'; Host = 'api.github.com'; Required = $true }
    [pscustomobject]@{ Service = 'Developpement'; Host = 'raw.githubusercontent.com'; Required = $true }
    [pscustomobject]@{ Service = 'Developpement'; Host = 'registry.npmjs.org'; Required = $true }
    [pscustomobject]@{ Service = 'Developpement'; Host = 'pypi.org'; Required = $true }
    [pscustomobject]@{ Service = 'Developpement'; Host = 'vercel.com'; Required = $true }
    [pscustomobject]@{ Service = 'Developpement'; Host = 'api.vercel.com'; Required = $true }
    [pscustomobject]@{ Service = 'Developpement'; Host = 'supabase.com'; Required = $true }
)

function Test-StrictTlsEndpoint {
    param(
        [Parameter(Mandatory)]
        [string]$Service,

        [Parameter(Mandatory)]
        [string]$EndpointHost,

        [Parameter(Mandatory)]
        [bool]$Required,

        [Parameter(Mandatory)]
        [int]$Timeout
    )

    $startedAt = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        [void][System.Net.Dns]::GetHostAddresses($EndpointHost)
    }
    catch {
        $startedAt.Stop()
        return [pscustomobject]@{
            Service = $Service
            Host = $EndpointHost
            Required = $Required
            Status = 'DnsFailure'
            DurationMs = $startedAt.ElapsedMilliseconds
            CertificateIssuer = $null
            TlsPolicyErrors = $null
        }
    }

    $tcpClient = [System.Net.Sockets.TcpClient]::new()
    $sslStream = $null

    try {
        $connectTask = $tcpClient.ConnectAsync($EndpointHost, 443)
        try {
            $connected = $connectTask.Wait($Timeout * 1000)
        }
        catch {
            $startedAt.Stop()
            return [pscustomobject]@{
                Service = $Service
                Host = $EndpointHost
                Required = $Required
                Status = 'TcpFailure'
                DurationMs = $startedAt.ElapsedMilliseconds
                CertificateIssuer = $null
                TlsPolicyErrors = $null
            }
        }

        if (-not $connected) {
            $startedAt.Stop()
            return [pscustomobject]@{
                Service = $Service
                Host = $EndpointHost
                Required = $Required
                Status = 'Timeout'
                DurationMs = $startedAt.ElapsedMilliseconds
                CertificateIssuer = $null
                TlsPolicyErrors = $null
            }
        }

        $sslStream = [System.Net.Security.SslStream]::new($tcpClient.GetStream(), $false)

        try {
            $authenticationTask = $sslStream.AuthenticateAsClientAsync($EndpointHost)
            $authenticated = $authenticationTask.Wait($Timeout * 1000)
        }
        catch {
            $startedAt.Stop()
            return [pscustomobject]@{
                Service = $Service
                Host = $EndpointHost
                Required = $Required
                Status = 'TlsFailure'
                DurationMs = $startedAt.ElapsedMilliseconds
                CertificateIssuer = $null
                TlsPolicyErrors = 'Certificate or TLS handshake rejected by the system trust policy'
            }
        }

        if (-not $authenticated) {
            $startedAt.Stop()
            return [pscustomobject]@{
                Service = $Service
                Host = $EndpointHost
                Required = $Required
                Status = 'Timeout'
                DurationMs = $startedAt.ElapsedMilliseconds
                CertificateIssuer = $null
                TlsPolicyErrors = $null
            }
        }

        $startedAt.Stop()
        return [pscustomobject]@{
            Service = $Service
            Host = $EndpointHost
            Required = $Required
            Status = 'Ready'
            DurationMs = $startedAt.ElapsedMilliseconds
            CertificateIssuer = if ($null -ne $sslStream.RemoteCertificate) {
                [string]$sslStream.RemoteCertificate.Issuer
            }
            else {
                $null
            }
            TlsPolicyErrors = $null
        }
    }
    finally {
        if ($null -ne $sslStream) {
            $sslStream.Dispose()
        }
        $tcpClient.Dispose()
    }
}

$results = foreach ($endpoint in $endpoints) {
    Test-StrictTlsEndpoint `
        -Service $endpoint.Service `
        -EndpointHost $endpoint.Host `
        -Required $endpoint.Required `
        -Timeout $TimeoutSeconds
}

$requiredFailures = @($results | Where-Object { $_.Required -and $_.Status -ne 'Ready' })

if ($Json) {
    [pscustomobject]@{
        CheckedAtUtc = [DateTime]::UtcNow.ToString('o')
        Ready = $requiredFailures.Count -eq 0
        RequiredFailureCount = $requiredFailures.Count
        Results = $results
    } | ConvertTo-Json -Depth 5
}
else {
    $results |
        Select-Object Service, Host, Required, Status, DurationMs, CertificateIssuer |
        Format-Table -AutoSize -Wrap

    if ($requiredFailures.Count -eq 0) {
        Write-Host 'POSTE IA PRET : tous les endpoints obligatoires passent la validation TLS stricte.' -ForegroundColor Green
    }
    else {
        Write-Host "POSTE IA NON PRET : $($requiredFailures.Count) endpoint(s) obligatoire(s) en echec." -ForegroundColor Red
        Write-Host 'Ne desactivez pas la verification TLS. Transmettez le rapport au service informatique habilite.' -ForegroundColor Yellow
    }
}

if ($requiredFailures.Count -gt 0) {
    exit 2
}

exit 0
