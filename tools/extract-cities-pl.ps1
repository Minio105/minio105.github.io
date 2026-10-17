# Ekstrakcja miast z Natural Earth 1:50m populated places (wersja "full" z tłumaczeniami).
# Zapisywany format: [nazwa_pl, lon, lat, populacja, czyStolica, nazwa_en]
param(
  [Parameter(Mandatory=$true)][string]$In,
  [Parameter(Mandatory=$true)][string]$Out
)

$raw = Get-Content -LiteralPath $In -Raw -Encoding UTF8
$chunks = $raw -split '"type":"Feature"'
$rxPl  = [regex]'"NAME_PL":"((?:[^"\\]|\\.)*)"'
$rxEn  = [regex]'"NAME_EN":"((?:[^"\\]|\\.)*)"'
$rxLat = [regex]'"LATITUDE":(-?[0-9.]+)'
$rxLon = [regex]'"LONGITUDE":(-?[0-9.]+)'
$rxPop = [regex]'"POP_MAX":([0-9]+)'
$rxCap = [regex]'"ADM0CAP":([0-9]+)'

$items = New-Object System.Collections.Generic.List[string]
for ($i = 1; $i -lt $chunks.Count; $i++) {
  $c = $chunks[$i]
  $mPl = $rxPl.Match($c); $mEn = $rxEn.Match($c)
  $mLa = $rxLat.Match($c); $mLo = $rxLon.Match($c); $mP = $rxPop.Match($c); $mC = $rxCap.Match($c)
  if (-not $mPl.Success -or -not $mLa.Success -or -not $mLo.Success) { continue }
  $namePl = $mPl.Groups[1].Value -replace '[\\"]', ''
  $nameEn = if ($mEn.Success) { $mEn.Groups[1].Value -replace '[\\"]', '' } else { $namePl }
  $lat = [double]$mLa.Groups[1].Value
  $lon = [double]$mLo.Groups[1].Value
  $pop = if ($mP.Success) { [int]$mP.Groups[1].Value } else { 0 }
  $cap = if ($mC.Success -and $mC.Groups[1].Value -eq '1') { 1 } else { 0 }
  if ($lat -gt 84 -or $lat -lt -58) { continue }
  $items.Add(("[`"$namePl`",$([math]::Round($lon,3)),$([math]::Round($lat,3)),$pop,$cap,`"$nameEn`"]"))
}

$header = "// Natural Earth 1:50m populated places -> [nazwaPL, lon, lat, populacja, czyStolica, nazwaEN] (domena publiczna)`nwindow.WORLD_CITIES=[`n"
$body = ($items -join ",`n")
$footer = "`n];`n"
[System.IO.File]::WriteAllText($Out, $header + $body + $footer, (New-Object System.Text.UTF8Encoding($false)))
Write-Output "features: $($chunks.Count - 1)  miast: $($items.Count)  -> $Out"
Write-Output ("probka PL: " + $items[0] + " | " + $items[[int]($items.Count/2)])
