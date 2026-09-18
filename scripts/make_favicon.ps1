Add-Type -AssemblyName System.Drawing

$cells = @(
  @(0,2), @(1,1), @(1,2), @(1,3), @(2,0), @(2,1), @(2,2), @(2,3), @(2,4),
  @(3,1), @(3,2), @(3,3), @(4,2)
)

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
  $s = $size / 64.0

  $bg = New-RoundedPath 0 0 $size $size (14 * $s)
  $brushBg = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 40, 144, 72))
  $g.FillPath($brushBg, $bg)

  $brushCell = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
  $cell = 9 * $s
  $pitch = 10 * $s
  $origin = 7.5 * $s
  $radius = [Math]::Max(0.5, 1.6 * $s)
  foreach ($c in $cells) {
    $x = $origin + $c[0] * $pitch
    $y = $origin + $c[1] * $pitch
    $cp = New-RoundedPath $x $y $cell $cell $radius
    $g.FillPath($brushCell, $cp)
    $cp.Dispose()
  }
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
Write-Output "生成完成：favicon.ico / favicon-32.png / apple-touch-icon.png"
