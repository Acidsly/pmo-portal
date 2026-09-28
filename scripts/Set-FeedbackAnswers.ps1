#Requires -Version 7.2
#Requires -Modules PnP.PowerShell
<#
.SYNOPSIS
    Разбор отзывов фокус-группы владельцем сайта: статусы и ответы, а также отзывы, пришедшие не через портал (письмом).

.DESCRIPTION
    Файл JSON (по умолчанию feedback-export/answers.json, вне git — в нём e-mail):
      { "update": [ { "id": 3, "status": "Зроблено", "answer": "…" } ],
        "add":    [ { "key": "letter-1", "author": "e-mail", "created": "2026-09-28T10:00:00+03:00", "screen": "Лист PMO",
                      "device": "лист", "text": "…", "status": "Зроблено", "answer": "…" } ] }
    Идемпотентен: update пишет только изменившиеся поля; add пропускает отзыв, если такой же текст уже есть.
    Общий список «Відгуки — загальні» обновит синхронизация. Запуск: Invoke-Env.ps1 -Env test -Action feedback-answers.
#>
param(
    [Parameter(Mandatory)][string]$SiteUrl,
    [Parameter(Mandatory)][string]$ClientId,
    [string]$Tenant,
    [string]$Thumbprint,
    [string]$CertificatePath,
    [SecureString]$CertificatePassword,
    [Parameter(Mandatory)][string]$File
)
$ErrorActionPreference = "Stop"
if ($Thumbprint)          { Connect-PnPOnline -Url $SiteUrl -ClientId $ClientId -Tenant $Tenant -Thumbprint $Thumbprint }
elseif ($CertificatePath) { Connect-PnPOnline -Url $SiteUrl -ClientId $ClientId -Tenant $Tenant -CertificatePath $CertificatePath -CertificatePassword $CertificatePassword }
else                      { Connect-PnPOnline -Url $SiteUrl -ClientId $ClientId -Interactive }

$STATUSES = @("Новий", "Прийнято", "Зроблено", "Прокоментовано", "Відхилено")
$cfg = Get-Content -Raw $File | ConvertFrom-Json
$all = @(Get-PnPListItem -List "Lists/Feedback" -PageSize 500 -Fields "ID", "fbText", "fbStatus", "fbAnswer")
$byId = @{}; foreach ($x in $all) { $byId[$x.Id] = $x }
$upd = 0; $new = 0
foreach ($u in @($cfg.update)) {
    if (-not $u) { continue }
    if ($STATUSES -notcontains $u.status) { throw "Відгук #$($u.id): невідомий статус «$($u.status)»" }
    $it = $byId[[int]$u.id]; if (-not $it) { Write-Warning "Відгук #$($u.id) не знайдено"; continue }
    $vals = @{}
    if ([string]$it["fbStatus"] -ne $u.status) { $vals.fbStatus = $u.status }
    if ([string]$it["fbAnswer"] -ne [string]$u.answer) { $vals.fbAnswer = [string]$u.answer }
    if ($vals.Count) { Set-PnPListItem -List "Lists/Feedback" -Identity $it.Id -Values $vals -UpdateType SystemUpdate | Out-Null; $upd++; Write-Host "  ~ #$($it.Id) $($u.status)" }
}
foreach ($a in @($cfg.add)) {
    if (-not $a) { continue }
    if ($STATUSES -notcontains $a.status) { throw "Новий відгук «$($a.key)»: невідомий статус «$($a.status)»" }
    if (@($all | Where-Object { ([string]$_["fbText"]).Trim() -eq ([string]$a.text).Trim() }).Count) { continue }
    $it = Add-PnPListItem -List "Lists/Feedback" -Values @{ fbText = $a.text; fbScreen = $a.screen; fbDevice = $a.device; fbStatus = $a.status; fbAnswer = $a.answer }
    # автор и дата — как в письме: отзыв этого человека, занесённый владельцем сайта
    Set-PnPListItem -List "Lists/Feedback" -Identity $it.Id -UpdateType UpdateOverwriteVersion `
        -Values @{ Author = $a.author; Editor = $a.author; Created = $a.created; Modified = $a.created } | Out-Null
    $new++; Write-Host "  + #$($it.Id) $($a.status): $(([string]$a.text).Substring(0, [Math]::Min(60, ([string]$a.text).Length)))"
}
Write-Host "Готово: оновлено $upd, додано $new. Загальний список оновить синхронізація." -ForegroundColor Green
