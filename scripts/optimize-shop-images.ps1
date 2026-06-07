# Regenerate WebP gallery + thumbnail assets from PNG masters.
# Run from repo root after adding new jersey PNGs to assets/media/shop/jerseys/

$base = Join-Path $PSScriptRoot "assets\media\shop\jerseys"
$opt = Join-Path $base "optimized"
$thumbs = Join-Path $base "thumbs"

New-Item -ItemType Directory -Force -Path $opt, $thumbs | Out-Null

Get-ChildItem "$base\*.png" | ForEach-Object {
  $stem = [System.IO.Path]::GetFileNameWithoutExtension($_.Name)
  Write-Host "Optimizing $($_.Name)..."
  npx --yes sharp-cli -i $_.FullName -o (Join-Path $opt ($stem + ".webp")) resize 1200 1200 --fit inside
  npx --yes sharp-cli -i $_.FullName -o (Join-Path $thumbs ($stem + ".webp")) resize 160 160 --fit cover
}

Write-Host "Done. Gallery images -> optimized/  |  Thumbnails -> thumbs/"
