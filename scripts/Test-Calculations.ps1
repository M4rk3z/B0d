$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$testOutput = Join-Path $projectRoot '.tools\calculation-tests'
New-Item -ItemType Directory -Force -Path $testOutput | Out-Null
& "$projectRoot\.tools\jdk\bin\javac.exe" -encoding UTF-8 -d $testOutput "$projectRoot\app\src\main\java\com\b0d\asistencia\ScheduleRules.java" "$projectRoot\app\src\main\java\com\b0d\asistencia\PunchRules.java" "$projectRoot\app\src\main\java\com\b0d\asistencia\WorkCalculator.java" "$projectRoot\tests\WorkCalculatorTest.java"
if ($LASTEXITCODE -ne 0) { throw 'Calculation test compilation failed' }
& "$projectRoot\.tools\jdk\bin\java.exe" -cp $testOutput com.b0d.asistencia.WorkCalculatorTest
if ($LASTEXITCODE -ne 0) { throw 'Calculation tests failed' }
