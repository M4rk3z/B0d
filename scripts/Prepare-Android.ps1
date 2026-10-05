$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$toolsRoot = Join-Path $projectRoot '.tools'
New-Item -ItemType Directory -Force -Path $toolsRoot | Out-Null

function Get-Archive($url, $destination, $checksum) {
    if (-not (Test-Path -LiteralPath $destination)) {
        & curl.exe --fail --location --retry 3 --silent --show-error --output $destination $url
        if ($LASTEXITCODE -ne 0) { throw "Download failed: $url" }
    }
    if ($checksum -and (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash -ne $checksum) {
        throw "Checksum mismatch: $destination"
    }
}

$jdkRoot = Join-Path $toolsRoot 'jdk'
if (-not (Test-Path "$jdkRoot\bin\java.exe")) {
    Write-Output 'Downloading JDK 17...'
    $assets = Invoke-RestMethod 'https://api.adoptium.net/v3/assets/latest/17/hotspot?architecture=x64&image_type=jdk&os=windows&vendor=eclipse'
    $package = $assets[0].binary.package
    Get-Archive $package.link "$toolsRoot\jdk.zip" $package.checksum
    Expand-Archive -LiteralPath "$toolsRoot\jdk.zip" -DestinationPath "$toolsRoot\jdk-extracted" -Force
    $extracted = Get-ChildItem "$toolsRoot\jdk-extracted" -Directory | Select-Object -First 1
    # Both paths are fixed children of this project's .tools directory.
    Move-Item -LiteralPath $extracted.FullName -Destination $jdkRoot
}

$gradleRoot = Join-Path $toolsRoot 'gradle-8.13'
if (-not (Test-Path "$gradleRoot\bin\gradle.bat")) {
    Write-Output 'Downloading Gradle 8.13...'
    $hash = (Invoke-RestMethod 'https://services.gradle.org/distributions/gradle-8.13-bin.zip.sha256').Trim()
    Get-Archive 'https://services.gradle.org/distributions/gradle-8.13-bin.zip' "$toolsRoot\gradle.zip" $hash
    Expand-Archive -LiteralPath "$toolsRoot\gradle.zip" -DestinationPath $toolsRoot -Force
}

$sdkRoot = Join-Path $toolsRoot 'android-sdk'
$cliRoot = Join-Path $sdkRoot 'cmdline-tools\latest'
if (-not (Test-Path "$cliRoot\bin\sdkmanager.bat")) {
    Write-Output 'Downloading Android command line tools...'
    Get-Archive 'https://dl.google.com/android/repository/commandlinetools-win-13114758_latest.zip' "$toolsRoot\android-cli.zip" '98b565cb657b012dae6794cefc0f66ae1efb4690c699b78a614b4a6a3505b003'
    Expand-Archive -LiteralPath "$toolsRoot\android-cli.zip" -DestinationPath "$toolsRoot\cli-extracted" -Force
    New-Item -ItemType Directory -Force -Path "$sdkRoot\cmdline-tools" | Out-Null
    Move-Item -LiteralPath "$toolsRoot\cli-extracted\cmdline-tools" -Destination $cliRoot
}

$env:JAVA_HOME = $jdkRoot
$env:ANDROID_HOME = $sdkRoot
$env:GRADLE_USER_HOME = Join-Path $toolsRoot 'gradle-cache'
$env:Path = "$jdkRoot\bin;" + $env:Path
Write-Output 'Preparing Android SDK packages and licenses...'
1..40 | ForEach-Object { 'y' } | & "$cliRoot\bin\sdkmanager.bat" "--sdk_root=$sdkRoot" --licenses
if ($LASTEXITCODE -ne 0) { throw 'SDK license setup failed' }
& "$cliRoot\bin\sdkmanager.bat" "--sdk_root=$sdkRoot" 'platforms;android-36' 'build-tools;35.0.0' 'platform-tools'
if ($LASTEXITCODE -ne 0) { throw 'SDK package setup failed' }
$sdkProperty = $sdkRoot.Replace('\', '/').Replace(':', '\:')
Set-Content -LiteralPath "$projectRoot\local.properties" -Value "sdk.dir=$sdkProperty" -Encoding ascii
Push-Location $projectRoot
try {
    & "$gradleRoot\bin\gradle.bat" --no-daemon wrapper --gradle-version 8.13
    if ($LASTEXITCODE -ne 0) { throw 'Gradle wrapper generation failed' }
} finally { Pop-Location }
Write-Output 'Android build tools ready.'
