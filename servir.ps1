# Servidor web mínimo para la simulación (solo localhost)
$root = $PSScriptRoot
$l = New-Object System.Net.HttpListener
$l.Prefixes.Add('http://localhost:8765/')
$l.Start()
Write-Host 'Sirviendo en http://localhost:8765/'
# Solo la página del receptor puede pedir archivos desde otra web (para probar en vivo)
$receptor = 'http://192.168.1.115:8073'
while ($l.IsListening) {
    $ctx = $l.GetContext()
    if ($ctx.Request.Headers['Origin'] -eq $receptor) {
        $ctx.Response.Headers.Add('Access-Control-Allow-Origin', $receptor)
        $ctx.Response.Headers.Add('Access-Control-Allow-Private-Network', 'true')
    }
    if ($ctx.Request.HttpMethod -eq 'OPTIONS') { $ctx.Response.Close(); continue }
    $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
    if ($rel -eq '') { $rel = 'autozoom/simulacion/index.html' }
    $path = [IO.Path]::GetFullPath((Join-Path $root $rel))
    if ($path.StartsWith($root) -and (Test-Path $path -PathType Leaf)) {
        $bytes = [IO.File]::ReadAllBytes($path)
        $ctx.Response.ContentType = if ($path.EndsWith('.js')) { 'text/javascript; charset=utf-8' } else { 'text/html; charset=utf-8' }
        $ctx.Response.Headers.Add('Cache-Control', 'no-store')
        $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
        $ctx.Response.StatusCode = 404
    }
    $ctx.Response.Close()
}
