#Requires -Version 7.2
# Макеты письма-дайджеста по демо-данным mockup-data.json → mockups/*.html (логотип — data URI, в рассылке — вложение cid:ppm-logo).
#   pwsh -NoLogo -File docs/digest/Build-Mockups.ps1
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "../../scripts/PMO.Digest.ps1")
$data = Get-Content -Raw (Join-Path $PSScriptRoot "mockup-data.json") | ConvertFrom-Json -AsHashtable
$logo = "data:image/png;base64," + [Convert]::ToBase64String([IO.File]::ReadAllBytes((Join-Path $PSScriptRoot "logo.png")))
$out = Join-Path $PSScriptRoot "mockups"
New-Item -ItemType Directory -Force -Path $out | Out-Null
foreach ($l in $data.letters) {
    $m = @{} + $l
    $m.portalUrl = $data.portalUrl
    $m.projects = @($l.projects | ForEach-Object { $p = @{} + $data.projects[$_]; $p.url = "$($data.portalUrl)/SitePages/Portal.aspx#project/$_"; $p })
    $m.attention = @($l.attention | Where-Object { $_ } | ForEach-Object { $a = @{} + $_; $a.title = $data.projects[$a.code].title; $a.url = "$($data.portalUrl)/SitePages/Portal.aspx#project/$($a.code)"; $a })
    $html = New-DigestHtml $m $logo
    Set-Content -Path (Join-Path $out $l.file) -Value $html -Encoding utf8NoBOM
    Write-Host ("  {0}: {1:n0} КБ" -f $l.file, ($html.Length / 1KB))
}
