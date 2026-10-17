# Scalanie miast z Natural Earth (domena publiczna):
#   $Base  - ne_50m_populated_places (wersja z tłumaczeniami, ma NAME_PL) - priorytet, polskie egzonimy
#   $Extra - ne_10m_populated_places (bez tłumaczeń) - uzupełnia tysiące mniejszych miast
# Wynik: [nazwaPL, lon, lat, populacja, czyStolica, nazwaEN] (bez duplikatów - te same miasta w obu zbiorach)
param(
  [Parameter(Mandatory=$true)][string]$Base,
  [Parameter(Mandatory=$true)][string]$Extra,
  [Parameter(Mandatory=$true)][string]$Out
)

$rxEn   = [regex]'"NAME_EN":"((?:[^"\\]|\\.)*)"'
$rxPl   = [regex]'"NAME_PL":"((?:[^"\\]|\\.)*)"'
$rxName = [regex]'"NAME":"((?:[^"\\]|\\.)*)"'
$rxAscii= [regex]'"NAMEASCII":"((?:[^"\\]|\\.)*)"'
$rxLat  = [regex]'"LATITUDE":(-?[0-9.]+)'
$rxLon  = [regex]'"LONGITUDE":(-?[0-9.]+)'
$rxPop  = [regex]'"POP_MAX":(-?[0-9]+)'
$rxCap  = [regex]'"ADM0CAP":([0-9]+)'

$accepted = New-Object System.Collections.Generic.List[object]
$buckets  = @{}

function Test-Near($lon, $lat, $minKm) {
  $bx = [int][math]::Floor($lon * 4); $by = [int][math]::Floor($lat * 4)
  for ($dx = -1; $dx -le 1; $dx++) {
    for ($dy = -1; $dy -le 1; $dy++) {
      $k = "$($bx + $dx)|$($by + $dy)"
      if ($buckets.ContainsKey($k)) {
        foreach ($idx in $buckets[$k]) {
          $c = $accepted[$idx]
          $cl = [math]::Cos($lat * [math]::PI / 180)
          $dlon = ($c.lon - $lon) * 111.32 * $cl
          $dlat = ($c.lat - $lat) * 111.32
          if ([math]::Sqrt($dlon * $dlon + $dlat * $dlat) -le $minKm) { return $true }
        }
      }
    }
  }
  return $false
}

function Add-City($name, $lon, $lat, $pop, $cap, $en, $minKm) {
  if (Test-Near $lon $lat $minKm) { return $false }
  $accepted.Add([pscustomobject]@{ name = $name; lon = $lon; lat = $lat; pop = $pop; cap = $cap; en = $en })
  $k = "$([int][math]::Floor($lon * 4))|$([int][math]::Floor($lat * 4))"
  if (-not $buckets.ContainsKey($k)) { $buckets[$k] = New-Object System.Collections.Generic.List[int] }
  $buckets[$k].Add($accepted.Count - 1)
  return $true
}

function Read-Cities($path) {
  $raw = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
  $chunks = $raw -split '"type":"Feature"'
  $list = New-Object System.Collections.Generic.List[object]
  for ($i = 1; $i -lt $chunks.Count; $i++) {
    $c = $chunks[$i]
    $mLa = $rxLat.Match($c); $mLo = $rxLon.Match($c)
    if (-not $mLa.Success -or -not $mLo.Success) { continue }
    $lat = [double]$mLa.Groups[1].Value; $lon = [double]$mLo.Groups[1].Value
    if ($lat -gt 84 -or $lat -lt -58) { continue }
    $mPl = $rxPl.Match($c); $mEn = $rxEn.Match($c); $mNm = $rxName.Match($c); $mAs = $rxAscii.Match($c)
    $pl = if ($mPl.Success) { $mPl.Groups[1].Value } else { '' }
    $en = if ($mEn.Success) { $mEn.Groups[1].Value } else { '' }
    $nm = if ($mNm.Success) { $mNm.Groups[1].Value } else { '' }
    $as = if ($mAs.Success) { $mAs.Groups[1].Value } else { '' }
    $mP = $rxPop.Match($c); $mC = $rxCap.Match($c)
    $pop = if ($mP.Success) { [int]$mP.Groups[1].Value } else { 0 }
    if ($pop -lt 0) { $pop = 0 }
    $cap = if ($mC.Success -and $mC.Groups[1].Value -eq '1') { 1 } else { 0 }
    $name = if ($pl -ne '') { $pl } elseif ($nm -ne '') { $nm } else { $as }
    if ($name -eq '') { continue }
    $list.Add([pscustomobject]@{ name = $name; en = $(if ($en -ne '') { $en } elseif ($as -ne '') { $as } else { $name }); lon = $lon; lat = $lat; pop = $pop; cap = $cap })
  }
  return $list
}

Write-Output "wczytuje baze (1:50m, polskie nazwy)..."
$baseList = Read-Cities $Base
$baseList = $baseList | Sort-Object -Property @{Expression = { $_.cap }; Descending = $true }, @{Expression = { $_.pop }; Descending = $true }
Write-Output "  baza: $($baseList.Count)"
foreach ($c in $baseList) { Add-City $c.name $c.lon $c.lat $c.pop $c.cap $c.en 20 | Out-Null }

Write-Output "wczytuje uzupelnienie (1:10m)..."
$extraList = Read-Cities $Extra
$extraList = $extraList | Sort-Object -Property @{Expression = { $_.pop }; Descending = $true }
Write-Output "  uzupelnienie: $($extraList.Count)"
$added = 0; $skipped = 0
foreach ($c in $extraList) {
  if (Add-City $c.name $c.lon $c.lat $c.pop $c.cap $c.en 22) { $added++ } else { $skipped++ }
}
Write-Output "  dodano: $added  pominietych duplikatow: $skipped"

$all = $accepted | Sort-Object -Property @{Expression = { $_.pop }; Descending = $true }
$items = New-Object System.Collections.Generic.List[string]
foreach ($c in $all) {
  $nm = $c.name -replace '[\\"]', ''
  $en = $c.en -replace '[\\"]', ''
  $items.Add(("[`"$nm`",$([math]::Round($c.lon,3)),$([math]::Round($c.lat,3)),$($c.pop),$($c.cap),`"$en`"]"))
}
$header = "// Natural Earth 1:50m (nazwy polskie) + 1:10m populated places - scalone, domena publiczna.`n// format: [nazwaPL, lon, lat, populacja, czyStolica, nazwaEN]`nwindow.WORLD_CITIES=[`n"
[System.IO.File]::WriteAllText($Out, $header + ($items -join ",`n") + "`n];`n", (New-Object System.Text.UTF8Encoding($false)))
Write-Output "miast razem: $($accepted.Count) -> $Out"
Write-Output ("probka: " + $items[0])
