Add-Type -AssemblyName System.Drawing

function New-RoundedPath([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $p.AddArc($x, $y, $d, $d, 180, 90)
  $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $p.CloseFigure()
  return $p
}

function New-IconBitmap([int]$size) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::Transparent)

  $bg = New-RoundedPath 0 0 $size $size ($size * 4 / 16)
  $brushBg = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 40, 144, 72))
  $g.FillPath($brushBg, $bg)
  $g.Dispose()
  return $bmp
}

$out = Join-Path (Split-Path $PSScriptRoot -Parent) "public"

$b32 = New-IconBitmap 32
$b32.Save((Join-Path $out "favicon-32.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$b180 = New-IconBitmap 180
$b180.Save((Join-Path $out "apple-touch-icon.png"), [System.Drawing.Imaging.ImageFormat]::Png)

$hicon = $b32.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($hicon)
$fs = [System.IO.File]::Create((Join-Path $out "favicon.ico"))
$icon.Save($fs)
$fs.Close()
$icon.Dispose()

$b128 = New-IconBitmap 128
$b128.Save((Join-Path $env:TEMP "favicon_preview_128.png"), [System.Drawing.Imaging.ImageFormat]::Png)

$b32.Dispose(); $b128.Dispose(); $b180.Dispose()
Write-Output "生成完成：favicon.ico / favicon-32.png / apple-touch-icon.png（纯绿圆角方块，与首页一致）"
