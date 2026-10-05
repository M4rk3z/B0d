$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$testOutput = Join-Path $projectRoot '.tools\punch-tests'
New-Item -ItemType Directory -Force -Path $testOutput | Out-Null
& "$projectRoot\.tools\jdk\bin\javac.exe" -encoding UTF-8 -d $testOutput "$projectRoot\app\src\main\java\com\b0d\asistencia\PunchRules.java" "$projectRoot\tests\PunchRulesTest.java"
if ($LASTEXITCODE -ne 0) { throw 'Attendance test compilation failed' }
& "$projectRoot\.tools\jdk\bin\java.exe" -cp $testOutput com.b0d.asistencia.PunchRulesTest
if ($LASTEXITCODE -ne 0) { throw 'Attendance tests failed' }
