$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$testOutput = Join-Path $projectRoot '.tools\dashboard-tests'
New-Item -ItemType Directory -Force -Path $testOutput | Out-Null
& "$projectRoot\.tools\jdk\bin\javac.exe" -encoding UTF-8 -d $testOutput "$projectRoot\app\src\main\java\com\b0d\asistencia\DashboardProgress.java" "$projectRoot\tests\DashboardProgressTest.java"
if ($LASTEXITCODE -ne 0) { throw 'Dashboard test compilation failed' }
& "$projectRoot\.tools\jdk\bin\java.exe" -cp $testOutput com.b0d.asistencia.DashboardProgressTest
if ($LASTEXITCODE -ne 0) { throw 'Dashboard tests failed' }
