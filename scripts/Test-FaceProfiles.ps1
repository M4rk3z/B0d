$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$testOutput = Join-Path $projectRoot '.tools\face-tests'
New-Item -ItemType Directory -Force -Path $testOutput | Out-Null
& "$projectRoot\.tools\jdk\bin\javac.exe" -encoding UTF-8 -d $testOutput "$projectRoot\app\src\main\java\com\b0d\asistencia\FacePhotoCipher.java" "$projectRoot\app\src\main\java\com\b0d\asistencia\FaceQuality.java" "$projectRoot\app\src\main\java\com\b0d\asistencia\FaceMatchRules.java" "$projectRoot\tests\FaceProfileTest.java"
if ($LASTEXITCODE -ne 0) { throw 'Face test compilation failed' }
& "$projectRoot\.tools\jdk\bin\java.exe" -cp $testOutput com.b0d.asistencia.FaceProfileTest
if ($LASTEXITCODE -ne 0) { throw 'Face tests failed' }
