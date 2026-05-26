Add-Type -AssemblyName System.Drawing

$outDir = Join-Path $PSScriptRoot "..\public\icons"
$outDir = [System.IO.Path]::GetFullPath($outDir)

function Save-AppIcon {
  param([int]$Size)

  $bmp = New-Object System.Drawing.Bitmap $Size, $Size
  $graphics = [System.Drawing.Graphics]::FromImage($bmp)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear([System.Drawing.Color]::FromArgb(255, 59, 130, 246))

  $fontSize = [int]($Size * 0.23)
  $font = New-Object System.Drawing.Font(
    "Malgun Gothic",
    $fontSize,
    [System.Drawing.FontStyle]::Bold,
    [System.Drawing.GraphicsUnit]::Pixel
  )
  $brush = [System.Drawing.Brushes]::White
  $format = New-Object System.Drawing.StringFormat
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center
  $rect = New-Object System.Drawing.RectangleF(0, 0, $Size, $Size)
  $graphics.DrawString("말씀", $font, $brush, $rect, $format)
  $graphics.Dispose()

  $path = Join-Path $outDir "app-icon-$Size.png"
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host "Wrote $path"
}

Save-AppIcon -Size 192
Save-AppIcon -Size 512
