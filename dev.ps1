# Run from any directory. Uses npm when available, otherwise the temporary
# npm runtime prepared during this workspace's initialization.
Set-Location $PSScriptRoot
$npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
if ($npmCommand) {
    & $npmCommand.Source run dev
} else {
    $frontendNpmCli = Join-Path $env:TEMP 'salessaas-npm/package/bin/npm-cli.js'
    if (-not (Test-Path -LiteralPath $frontendNpmCli)) {
        throw 'Instalá Node.js con npm y ejecutá npm ci seguido de npm run dev.'
    }
    & node $frontendNpmCli run dev
}
