$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$env:JAVA_HOME = Join-Path $projectRoot '.tools\jdk'
$env:ANDROID_HOME = Join-Path $projectRoot '.tools\android-sdk'
$env:GRADLE_USER_HOME = Join-Path $projectRoot '.tools\gradle-cache'
$env:Path = "$env:JAVA_HOME\bin;" + $env:Path
if (-not (Test-Path "$env:JAVA_HOME\bin\java.exe")) {
    throw 'Run scripts/Prepare-Android.ps1 first.'
}
Push-Location $projectRoot
try {
    & '.\gradlew.bat' --no-daemon :app:assembleDebug :app:lintDebug
    if ($LASTEXITCODE -ne 0) { throw 'Android build or lint failed' }
} finally { Pop-Location }
