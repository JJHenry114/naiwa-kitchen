param([int]$Port = 8770)
$ErrorActionPreference = 'Stop'
$gameRoot = $PSScriptRoot
$gameUrl = "http://127.0.0.1:$Port/"
try {
    $page = Invoke-WebRequest -Uri $gameUrl -UseBasicParsing -TimeoutSec 2
    if ($page.Content -match 'restaurant-app.js') { Start-Process $gameUrl; exit }
    throw "Port $Port is already used by another application."
} catch {
    if ($_.Exception.Message -match 'already used') { throw }
}
$runtime = Get-Command node -ErrorAction SilentlyContinue
$gameNode = if ($runtime) { $runtime.Source } else { Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' }
if (!(Test-Path -LiteralPath $gameNode)) { throw 'Please install Node.js, then open this launcher again.' }
$env:PORT = "$Port"
Start-Process -FilePath $gameNode -ArgumentList ('"' + (Join-Path $gameRoot 'server.mjs') + '"') -WorkingDirectory $gameRoot -WindowStyle Hidden
for ($attempt=0; $attempt -lt 20; $attempt++) {
    Start-Sleep -Milliseconds 200
    try {
        $page = Invoke-WebRequest -Uri $gameUrl -UseBasicParsing -TimeoutSec 1
        if ($page.Content -match 'restaurant-app.js') { Start-Process $gameUrl; exit }
    } catch { }
}
throw 'The local game server did not start. Try: node server.mjs'
