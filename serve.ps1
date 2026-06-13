# Simple static file server — no admin required (uses TcpListener, not HttpListener)
# Run: powershell -ExecutionPolicy Bypass -File serve.ps1

param([int]$Port = 8080)

$root = $PSScriptRoot

$mimes = @{
    '.html' = 'text/html; charset=utf-8'
    '.css'  = 'text/css; charset=utf-8'
    '.js'   = 'application/javascript; charset=utf-8'
    '.jsx'  = 'application/javascript; charset=utf-8'
    '.svg'  = 'image/svg+xml'
    '.png'  = 'image/png'
    '.jpg'  = 'image/jpeg'
    '.jpeg' = 'image/jpeg'
    '.ico'  = 'image/x-icon'
    '.json' = 'application/json; charset=utf-8'
    '.avif' = 'image/avif'
    '.pdf'  = 'application/pdf'
}

function Send-Response($stream, $status, $mime, $body) {
    $statusLine = switch ($status) { 200 { 'OK' } 404 { 'Not Found' } default { 'Error' } }
    $headers  = "HTTP/1.1 $status $statusLine`r`n"
    $headers += "Content-Type: $mime`r`n"
    $headers += "Content-Length: $($body.Length)`r`n"
    $headers += "Connection: close`r`n"
    $headers += "`r`n"
    $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($headers)
    $stream.Write($headerBytes, 0, $headerBytes.Length)
    $stream.Write($body, 0, $body.Length)
}

$listener = [System.Net.Sockets.TcpListener][System.Net.IPAddress]::Any, $Port
$listener.Start()

$ip = (Get-NetIPAddress -AddressFamily IPv4 |
       Where-Object { $_.InterfaceAlias -notmatch 'Loopback' -and $_.IPAddress -notmatch '^169' } |
       Select-Object -First 1).IPAddress

Write-Host ""
Write-Host "  Serving: $root"
Write-Host "  Local:   http://localhost:$Port/ui_kits/stub/creator.html"
Write-Host "  Phone:   http://${ip}:$Port/ui_kits/stub/creator.html"
Write-Host ""
Write-Host "  Press Ctrl+C to stop."
Write-Host ""

try {
    while ($true) {
        $client = $listener.AcceptTcpClient()
        $stream = $client.GetStream()
        try {
            # Read request line
            $buf = New-Object byte[] 4096
            $read = $stream.Read($buf, 0, $buf.Length)
            $req = [System.Text.Encoding]::ASCII.GetString($buf, 0, $read)
            $line = ($req -split "`r?`n")[0]   # e.g. "GET /path HTTP/1.1"
            if ($line -match '^(GET|HEAD)\s+(\S+)') {
                $urlPath = $Matches[2] -replace '\?.*','' -replace '/','\' -replace '^\\',''
                if ($urlPath -eq '' -or $urlPath -eq '\') { $urlPath = 'index.html' }
                $filePath = Join-Path $root $urlPath
                if (Test-Path $filePath -PathType Leaf) {
                    $ext  = [System.IO.Path]::GetExtension($filePath).ToLower()
                    $mime = if ($mimes.ContainsKey($ext)) { $mimes[$ext] } else { 'application/octet-stream' }
                    $bytes = [System.IO.File]::ReadAllBytes($filePath)
                    Send-Response $stream 200 $mime $bytes
                    Write-Host "  200  /$($urlPath -replace '\\','/')"
                } else {
                    $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
                    Send-Response $stream 404 'text/plain' $msg
                    Write-Host "  404  /$($urlPath -replace '\\','/')"
                }
            }
        } catch {}
        $stream.Close(); $client.Close()
    }
} finally {
    $listener.Stop()
}
