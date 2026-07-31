[CmdletBinding()]
param(
    [switch]$SkipImages
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RootDirectory = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$DockerBuildNetwork = $env:NEXORA_DOCKER_BUILD_NETWORK

function Assert-Command {
    param(
        [Parameter(Mandatory)] [string]$Name,
        [Parameter(Mandatory)] [string]$Guidance
    )

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "$Name is required but was not found in PATH. $Guidance"
    }
}

function Invoke-Checked {
    param(
        [Parameter(Mandatory)] [string]$Title,
        [Parameter(Mandatory)] [string]$Command,
        [Parameter(Mandatory)] [string[]]$Arguments
    )

    Write-Host "`n==> $Title"
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Title failed with exit code $LASTEXITCODE."
    }
}

Assert-Command -Name 'pnpm' -Guidance 'Run .\scripts\bootstrap.ps1 after installing pnpm 10.'
Assert-Command -Name 'poetry' -Guidance 'Run .\scripts\bootstrap.ps1 after installing Poetry 2.'
Assert-Command -Name 'docker' -Guidance 'Install Docker Desktop or Docker Engine with Compose v2.'

Set-Location $RootDirectory

Invoke-Checked -Title 'Docker Compose v2 availability' -Command 'docker' -Arguments @('compose', 'version')
Invoke-Checked -Title 'JavaScript dependency audit' -Command 'pnpm' -Arguments @('run', 'audit:dependencies')
Invoke-Checked -Title 'JavaScript formatting' -Command 'pnpm' -Arguments @('run', 'format:check')
Invoke-Checked -Title 'Workspace lint' -Command 'pnpm' -Arguments @('run', 'lint')
Invoke-Checked -Title 'Workspace strict type checking' -Command 'pnpm' -Arguments @('run', 'typecheck')
Invoke-Checked -Title 'Workspace tests and coverage' -Command 'pnpm' -Arguments @('run', 'test')
Invoke-Checked -Title 'Workspace production builds' -Command 'pnpm' -Arguments @('run', 'build')
Invoke-Checked -Title 'Backend formatting, lint, typing, tests, and coverage' -Command 'pnpm' -Arguments @('run', 'validate:api')
Invoke-Checked -Title 'API import and required-route smoke' -Command 'poetry' -Arguments @('--directory', 'apps/api', 'run', 'python', 'scripts/smoke_app.py')
Invoke-Checked -Title 'Alembic upgrade/downgrade/re-upgrade' -Command 'poetry' -Arguments @('--directory', 'apps/api', 'run', 'python', 'scripts/validate_migrations.py')

$ComposeEnvironment = if (Test-Path '.env') { '.env' } else { '.env.example' }
if ($ComposeEnvironment -eq '.env.example') {
    Write-Host "`nUsing .env.example for non-runtime Compose rendering."
}

foreach ($Profile in @('core', 'automation', 'ai', 'monitoring', 'full')) {
    Invoke-Checked -Title "Compose profile: $Profile" -Command 'docker' -Arguments @('compose', '--env-file', $ComposeEnvironment, '--profile', $Profile, 'config', '--quiet')
}

if (-not $SkipImages) {
    Invoke-Checked -Title 'Docker daemon availability' -Command 'docker' -Arguments @('info')
    $BuildNetworkArguments = @()
    if (-not [string]::IsNullOrWhiteSpace($DockerBuildNetwork)) {
        $BuildNetworkArguments = @('--network', $DockerBuildNetwork)
        Write-Host "`nUsing Docker build network: $DockerBuildNetwork"
    }
    Invoke-Checked -Title 'API production image' -Command 'docker' -Arguments (@('build') + $BuildNetworkArguments + @('--pull=false', '-t', 'nexora-api:validation', 'apps/api'))
    Invoke-Checked -Title 'Web production image' -Command 'docker' -Arguments (@('build') + $BuildNetworkArguments + @('--pull=false', '-f', 'apps/web/Dockerfile', '-t', 'nexora-web:validation', '.'))
}
else {
    Write-Host "`nContainer image builds skipped by explicit request."
}

Write-Host "`nAll selected engineering-foundation validation gates passed."
