$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:8765/")
$listener.Start()
Write-Host "Mostownia server: http://localhost:8765/"
while ($true) {
  try {
    $ctx = $listener.GetContext()
    $relative = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
    if ([string]::IsNullOrWhiteSpace($relative)) { $relative = "index.html" }
    $path = [System.IO.Path]::GetFullPath((Join-Path $root $relative))
    if (-not $path.StartsWith($root)) { $ctx.Response.StatusCode = 403; $ctx.Response.Close(); continue }
    if (-not (Test-Path $path -PathType Leaf)) { $ctx.Response.StatusCode = 404; $ctx.Response.Close(); continue }
    $ext = [System.IO.Path]::GetExtension($path).ToLowerInvariant()
    $type = switch ($ext) {
      ".html" { "text/html; charset=utf-8" }
      ".css"  { "text/css; charset=utf-8" }
      ".js"   { "text/javascript; charset=utf-8" }
      ".png"  { "image/png" }
      ".jpg"  { "image/jpeg" }
      ".svg"  { "image/svg+xml" }
      default { "application/octet-stream" }
    }
    $bytes = [System.IO.File]::ReadAllBytes($path)
    $ctx.Response.ContentType = $type
    $ctx.Response.ContentLength64 = $bytes.Length
    $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    $ctx.Response.OutputStream.Close()
  } catch {
    try { $ctx.Response.StatusCode = 500; $ctx.Response.Close() } catch {}
  }
}
