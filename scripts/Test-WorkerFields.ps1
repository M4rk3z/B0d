$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$testOutput = Join-Path $projectRoot '.tools\worker-tests'
New-Item -ItemType Directory -Force -Path $testOutput | Out-Null
& "$projectRoot\.tools\jdk\bin\javac.exe" -encoding UTF-8 -d $testOutput "$projectRoot\app\src\main\java\com\b0d\asistencia\WorkerFields.java" "$projectRoot\tests\WorkerFieldsTest.java"
if ($LASTEXITCODE -ne 0) { throw 'Worker test compilation failed' }
& "$projectRoot\.tools\jdk\bin\java.exe" -cp $testOutput com.b0d.asistencia.WorkerFieldsTest
if ($LASTEXITCODE -ne 0) { throw 'Worker tests failed' }
