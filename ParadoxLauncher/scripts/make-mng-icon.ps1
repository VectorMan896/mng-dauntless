# [MNG DAUNTLESS 2026-10-31] Draws the launcher's icon source (src-tauri\icons\source-mng.png, 1024 px) in the "Frost & Ember"
# colours: the MNG mark and letters (cropped from src\assets\brand\mng-logo.png; the DAUNTLESS line is too small to read at
# taskbar size) on a rounded charcoal tile with a pale mint edge and glow. Then generate every size with:
#   npx tauri icon src-tauri\icons\source-mng.png
param(
    [string]$Logo = (Join-Path $PSScriptRoot "..\src\assets\brand\mng-logo.png"),
    [string]$Out = (Join-Path $PSScriptRoot "..\src-tauri\icons\source-mng.png")
)
Add-Type -AssemblyName System.Drawing

$Size = 1024
$Bmp = [System.Drawing.Bitmap]::new($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$G = [System.Drawing.Graphics]::FromImage($Bmp)
$G.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$G.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$G.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$G.Clear([System.Drawing.Color]::Transparent)

function RoundedRect([float]$X, [float]$Y, [float]$W, [float]$H, [float]$R) {
    $P = New-Object System.Drawing.Drawing2D.GraphicsPath
    $D = $R * 2
    $P.AddArc($X, $Y, $D, $D, 180, 90)
    $P.AddArc($X + $W - $D, $Y, $D, $D, 270, 90)
    $P.AddArc($X + $W - $D, $Y + $H - $D, $D, $D, 0, 90)
    $P.AddArc($X, $Y + $H - $D, $D, $D, 90, 90)
    $P.CloseFigure()
    return $P
}

# Tile: charcoal at the top to near-black at the bottom.
$Margin = 40
$Tile = RoundedRect $Margin $Margin ($Size - 2 * $Margin) ($Size - 2 * $Margin) 190
$Fill = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    [System.Drawing.Point]::new(0, $Margin), [System.Drawing.Point]::new(0, ($Size - $Margin)),
    [System.Drawing.Color]::FromArgb(255, 44, 44, 49), [System.Drawing.Color]::FromArgb(255, 12, 12, 14))
$G.FillPath($Fill, $Tile)

# Mint glow rising from the bottom, clipped to the tile.
$G.SetClip($Tile)
$GlowPath = New-Object System.Drawing.Drawing2D.GraphicsPath
$GlowPath.AddEllipse(112, 600, 800, 640)
$Glow = [System.Drawing.Drawing2D.PathGradientBrush]::new($GlowPath)
$Glow.CenterColor = [System.Drawing.Color]::FromArgb(95, 207, 238, 226)
$Glow.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 207, 238, 226))
$G.FillPath($Glow, $GlowPath)
# A soft sheen at the top.
$SheenPath = New-Object System.Drawing.Drawing2D.GraphicsPath
$SheenPath.AddEllipse(160, -260, 704, 560)
$Sheen = [System.Drawing.Drawing2D.PathGradientBrush]::new($SheenPath)
$Sheen.CenterColor = [System.Drawing.Color]::FromArgb(45, 255, 255, 255)
$Sheen.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 255, 255, 255))
$G.FillPath($Sheen, $SheenPath)
$G.ResetClip()

# Logo: the mark and the MNG letters.
$Src = [System.Drawing.Image]::FromFile((Resolve-Path $Logo))
$Crop = [System.Drawing.Rectangle]::new(225, 105, 800, 745)
$TargetW = 690
$TargetH = [int]($TargetW * $Crop.Height / $Crop.Width)
$Dest = [System.Drawing.Rectangle]::new([int](($Size - $TargetW) / 2), [int](($Size - $TargetH) / 2) - 10, $TargetW, $TargetH)
# A soft dark shadow under the logo so it stands off the glow.
$Shadow = New-Object System.Drawing.Imaging.ColorMatrix
$Shadow.Matrix00 = 0; $Shadow.Matrix11 = 0; $Shadow.Matrix22 = 0; $Shadow.Matrix33 = 0.55
$ShadowAttr = New-Object System.Drawing.Imaging.ImageAttributes
$ShadowAttr.SetColorMatrix($Shadow)
foreach ($Offset in @(@(0, 14), @(0, 8))) {
    $R = [System.Drawing.Rectangle]::new($Dest.X + $Offset[0], $Dest.Y + $Offset[1], $Dest.Width, $Dest.Height)
    $G.DrawImage($Src, $R, $Crop.X, $Crop.Y, $Crop.Width, $Crop.Height, [System.Drawing.GraphicsUnit]::Pixel, $ShadowAttr)
}
$G.DrawImage($Src, $Dest, $Crop.X, $Crop.Y, $Crop.Width, $Crop.Height, [System.Drawing.GraphicsUnit]::Pixel)
$Src.Dispose()

# Mint edge.
$Edge = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    [System.Drawing.Point]::new(0, $Margin), [System.Drawing.Point]::new(0, ($Size - $Margin)),
    [System.Drawing.Color]::FromArgb(120, 232, 248, 241), [System.Drawing.Color]::FromArgb(255, 207, 238, 226))
$Pen = [System.Drawing.Pen]::new($Edge, 14)
$Inner = RoundedRect ($Margin + 7) ($Margin + 7) ($Size - 2 * $Margin - 14) ($Size - 2 * $Margin - 14) 183
$G.DrawPath($Pen, $Inner)

$G.Dispose()
$Bmp.Save((Join-Path (Resolve-Path (Split-Path $Out)) (Split-Path $Out -Leaf)), [System.Drawing.Imaging.ImageFormat]::Png)
$Bmp.Dispose()
Write-Output "Wrote $Out"
