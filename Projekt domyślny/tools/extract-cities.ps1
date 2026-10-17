# Ekstrakcja miast z Natural Earth 1:50m populated places do zwartego pliku JS.
# Uruchomienie: powershell -ExecutionPolicy Bypass -File tools/extract-cities.ps1 <input.geojson> <output.js>
param(
  [Parameter(Mandatory=$true)][string]$In,
  [Parameter(Mandatory=$true)][string]$Out
)

$raw = Get-Content -LiteralPath $In -Raw
$chunks = $raw -split '"type":"Feature"'
$rxName = [regex]'"name":"((?:[^"\\]|\\.)*)"'
$rxLat  = [regex]'"latitude":(-?[0-9.]+)'
$rxLon  = [regex]'"longitude":(-?[0-9.]+)'
$rxPop  = [regex]'"pop_max":([0-9]+)'
$rxCap  = [regex]'"adm0cap":([0-9]+)'

$items = New-Object System.Collections.Generic.List[string]
for ($i = 1; $i -lt $chunks.Count; $i++) {
  $c = $chunks[$i]
  $mN = $rxName.Match($c); $mLa = $rxLat.Match($c); $mLo = $rxLon.Match($c); $mP = $rxPop.Match($c); $mC = $rxCap.Match($c)
  if (-not $mN.Success -or -not $mLa.Success -or -not $mLo.Success) { continue }
  $name = $mN.Groups[1].Value -replace '[\\"]', ''
  $lat = [double]$mLa.Groups[1].Value
  $lon = [double]$mLo.Groups[1].Value
  $pop = if ($mP.Success) { [int]$mP.Groups[1].Value } else { 0 }
  $cap = if ($mC.Success -and $mC.Groups[1].Value -eq '1') { 1 } else { 0 }
  # tylko zakres mapy gry
  if ($lat -gt 84 -or $lat -lt -58) { continue }
  $items.Add(("[`"$name`",$([math]::Round($lon,3)),$([math]::Round($lat,3)),$pop,$cap]"))
}

$header = "// Natural Earth 1:50m populated places -> [nazwa, lon, lat, populacja, czyStolica] (domena publiczna)`nwindow.WORLD_CITIES=[`n"
$body = ($items -join ",`n")
$footer = "`n];`n"
[System.IO.File]::WriteAllText($Out, $header + $body + $footer, (New-Object System.Text.UTF8Encoding($false)))

Write-Output "features: $($chunks.Count - 1)  zapisano miast: $($items.Count)  -> $Out"
Write-Output ("probka: " + $items[0])
Write-Output ("probka: " + $items[[int]($items.Count/2)])
