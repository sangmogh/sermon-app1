# Pastel book icon PNGs for PWA (no text — avoids broken glyphs on iOS).
# Run: powershell -ExecutionPolicy Bypass -File scripts/generate-pwa-icons.ps1

Add-Type -AssemblyName System.Drawing

$outDir = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\public\icons"))

function New-Color($r, $g, $b) {
  return [System.Drawing.Color]::FromArgb(255, $r, $g, $b)
}

function Save-AppIcon {
  param([int]$Size)

  $bmp = New-Object System.Drawing.Bitmap $Size, $Size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

  $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.Point(0, 0)),
    (New-Object System.Drawing.Point($Size, $Size)),
    (New-Color 239 246 255),
    (New-Color 236 253 245)
  )
  $g.FillRectangle($bgBrush, 0, 0, $Size, $Size)
  $bgBrush.Dispose()

  $plateInset = [int]($Size * 0.17)
  $plateSize = $Size - (2 * $plateInset)
  $radius = [int]($plateSize * 0.24)
  $platePath = New-Object System.Drawing.Drawing2D.GraphicsPath
  $plateRect = New-Object System.Drawing.Rectangle(
    $plateInset,
    $plateInset,
    $plateSize,
    $plateSize
  )
  $platePath.AddArc($plateRect.X, $plateRect.Y, $radius, $radius, 180, 90)
  $platePath.AddArc($plateRect.Right - $radius, $plateRect.Y, $radius, $radius, 270, 90)
  $platePath.AddArc($plateRect.Right - $radius, $plateRect.Bottom - $radius, $radius, $radius, 0, 90)
  $platePath.AddArc($plateRect.X, $plateRect.Bottom - $radius, $radius, $radius, 90, 90)
  $platePath.CloseFigure()
  $g.FillPath([System.Drawing.Brushes]::White, $platePath)
  $platePath.Dispose()

  $cx = $Size / 2.0
  $cy = $Size * 0.54
  $bw = $Size * 0.36
  $bh = $Size * 0.28

  $leftBrush = New-Object System.Drawing.SolidBrush (New-Color 79 70 229)
  $rightBrush = New-Object System.Drawing.SolidBrush (New-Color 99 102 241)
  $spineBrush = New-Object System.Drawing.SolidBrush (New-Color 67 56 202)
  $ribbonBrush = New-Object System.Drawing.SolidBrush (New-Color 245 158 11)

  $left = @(
    [System.Drawing.PointF]::new($cx - $bw, $cy - $bh),
    [System.Drawing.PointF]::new($cx - 4, $cy - $bh * 0.82),
    [System.Drawing.PointF]::new($cx - 4, $cy + $bh),
    [System.Drawing.PointF]::new($cx - $bw, $cy + $bh * 0.88)
  )
  $right = @(
    [System.Drawing.PointF]::new($cx + 4, $cy - $bh * 0.82),
    [System.Drawing.PointF]::new($cx + $bw, $cy - $bh),
    [System.Drawing.PointF]::new($cx + $bw, $cy + $bh * 0.88),
    [System.Drawing.PointF]::new($cx + 4, $cy + $bh)
  )
  $g.FillPolygon($leftBrush, $left)
  $g.FillPolygon($rightBrush, $right)
  $g.FillRectangle($spineBrush, ($cx - 4), ($cy - $bh * 0.82), 8, ($bh * 1.82))

  $ribbonW = $Size * 0.05
  $ribbonH = $Size * 0.08
  $g.FillPolygon(
    $ribbonBrush,
    @(
      [System.Drawing.PointF]::new($cx - $ribbonW, $cy - $bh * 1.05),
      [System.Drawing.PointF]::new($cx + $ribbonW, $cy - $bh * 1.05),
      [System.Drawing.PointF]::new($cx + $ribbonW * 1.4, $cy - $bh * 0.72),
      [System.Drawing.PointF]::new($cx - $ribbonW * 1.4, $cy - $bh * 0.72)
    )
  )

  $leftBrush.Dispose()
  $rightBrush.Dispose()
  $spineBrush.Dispose()
  $ribbonBrush.Dispose()
  $g.Dispose()

  $path = Join-Path $outDir "app-icon-$Size.png"
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host "Wrote $path"
}

function Save-Splash {
  param([int]$Width, [int]$Height, [string]$FileName)

  $bmp = New-Object System.Drawing.Bitmap $Width, $Height
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

  $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.Point(0, 0)),
    (New-Object System.Drawing.Point($Width, $Height)),
    (New-Color 250 250 250),
    (New-Color 239 246 255)
  )
  $g.FillRectangle($bgBrush, 0, 0, $Width, $Height)
  $bgBrush.Dispose()

  $iconSize = [int]([Math]::Min($Width, $Height) * 0.28)
  $iconBmp = New-Object System.Drawing.Bitmap (Join-Path $outDir "app-icon-512.png")
  $scaled = New-Object System.Drawing.Bitmap $iconSize, $iconSize
  $ig = [System.Drawing.Graphics]::FromImage($scaled)
  $ig.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $ig.DrawImage($iconBmp, 0, 0, $iconSize, $iconSize)
  $ig.Dispose()
  $iconBmp.Dispose()

  $x = ($Width - $iconSize) / 2
  $y = ($Height - $iconSize) / 2 - ($Height * 0.06)
  $g.DrawImage($scaled, $x, $y, $iconSize, $iconSize)
  $scaled.Dispose()
  $g.Dispose()

  $path = Join-Path $outDir $FileName
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host "Wrote $path"
}

Save-AppIcon -Size 192
Save-AppIcon -Size 512
Save-Splash -Width 1170 -Height 2532 -FileName "apple-splash-1170x2532.png"
Save-Splash -Width 1284 -Height 2778 -FileName "apple-splash-1284x2778.png"
