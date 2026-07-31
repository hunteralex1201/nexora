[CmdletBinding()]
param(
    [switch]$SkipInstall,
    [switch]$NoEnv
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RootDirectory = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

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
        [Parameter(Mandatory)] [string]$Command,
        [Parameter(Mandatory)] [string[]]$Arguments
    )

    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Command failed with exit code $LASTEXITCODE."
    }
}

Assert-Command -Name 'node' -Guidance 'Install Node.js 20.9 or newer.'
Assert-Command -Name 'pnpm' -Guidance 'Install pnpm 10 or enable the packageManager release through Corepack.'
Assert-Command -Name 'poetry' -Guidance 'Install Poetry 2.x for the API environment.'
Assert-Command -Name 'python' -Guidance 'Install Python 3.11 or newer.'

$NodeVersion = (& node --version).TrimStart('v')
$NodeMajor = [int]($NodeVersion.Split('.')[0])
if ($NodeMajor -lt 20) {
    throw "Node.js 20.9 or newer is required; found $NodeVersion."
}

$PythonVersion = (& python -c 'import sys; print(sys.version_info.major, sys.version_info.minor, sep=chr(46))').Trim()
$PythonParts = $PythonVersion.Split('.')
if ([int]$PythonParts[0] -lt 3 -or ([int]$PythonParts[0] -eq 3 -and [int]$PythonParts[1] -lt 11)) {
    throw "Python 3.11 or newer is required; found $PythonVersion."
}

Set-Location $RootDirectory

if (-not $NoEnv -and -not (Test-Path '.env')) {
    Copy-Item '.env.example' '.env'
    Write-Host 'Created .env from .env.example.'
    Write-Warning 'Replace every CHANGE_ME value before starting shared or persistent services.'
}
elseif (Test-Path '.env') {
    Write-Host 'Preserved existing .env.'
}

if (-not $SkipInstall) {
    Invoke-Checked -Command 'pnpm' -Arguments @('install', '--frozen-lockfile')
    Invoke-Checked -Command 'poetry' -Arguments @('--directory', 'apps/api', 'install', '--with', 'dev', '--no-interaction', '--no-ansi')
}
else {
    Write-Host 'Dependency installation skipped by request.'
}

Write-Host 'Bootstrap complete. No services were started and no external systems were modified.'
Write-Host 'Run .\scripts\validate.ps1 for the complete local foundation validation gate.'
