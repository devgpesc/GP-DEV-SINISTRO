Add-Type -AssemblyName System.Drawing

$outputDir = Join-Path $PSScriptRoot '..\public\icons'
New-Item -ItemType Directory -Path $outputDir -Force | Out-Null

function New-EventsCarIcon {
    param(
        [int]$Size,
        [string]$FileName,
        [double]$Scale = 0.64
    )

    $bitmap = New-Object System.Drawing.Bitmap($Size, $Size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.Clear([System.Drawing.Color]::FromArgb(17, 24, 39))

    $unit = ($Size * $Scale) / 24
    $offset = ($Size - (24 * $unit)) / 2
    $point = {
        param([double]$x, [double]$y)
        New-Object System.Drawing.PointF(($offset + ($x * $unit)), ($offset + ($y * $unit)))
    }

    $whitePen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, [float]($Size * 0.048))
    $bluePen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(88, 166, 255), [float]($Size * 0.038))
    foreach ($pen in @($whitePen, $bluePen)) {
        $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
        $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
        $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    }

    [System.Drawing.PointF[]]$mainPath = @(
        (& $point 21 7), (& $point 12 2), (& $point 3 7),
        (& $point 12 12), (& $point 21 17), (& $point 12 22), (& $point 3 17)
    )
    [System.Drawing.PointF[]]$upperAccent = @((& $point 7.5 9.5), (& $point 15.75 9.5), (& $point 18.5 7))
    [System.Drawing.PointF[]]$lowerAccent = @((& $point 16.5 14.5), (& $point 8.25 14.5), (& $point 5.5 17))

    $graphics.DrawLines($whitePen, $mainPath)
    $graphics.DrawLines($bluePen, $upperAccent)
    $graphics.DrawLines($bluePen, $lowerAccent)

    $path = Join-Path $outputDir $FileName
    $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)

    $whitePen.Dispose()
    $bluePen.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
}

New-EventsCarIcon -Size 192 -FileName 'events-car-192.png' -Scale 0.66
New-EventsCarIcon -Size 512 -FileName 'events-car-512.png' -Scale 0.66
New-EventsCarIcon -Size 512 -FileName 'events-car-maskable-512.png' -Scale 0.56

Write-Output 'Icones PWA gerados em public/icons.'
