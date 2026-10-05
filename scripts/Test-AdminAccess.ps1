$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$testOutput = Join-Path $projectRoot '.tools\policy-tests'
New-Item -ItemType Directory -Force -Path $testOutput | Out-Null
& "$projectRoot\.tools\jdk\bin\javac.exe" -encoding UTF-8 -d $testOutput "$projectRoot\app\src\main\java\com\b0d\asistencia\AdminAccess.java" "$projectRoot\tests\AdminAccessTest.java"
if ($LASTEXITCODE -ne 0) { throw 'Policy test compilation failed' }
& "$projectRoot\.tools\jdk\bin\java.exe" -cp $testOutput com.b0d.asistencia.AdminAccessTest
if ($LASTEXITCODE -ne 0) { throw 'Policy tests failed' }
