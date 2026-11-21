@echo off
chcp 65001 >nul
echo ========================================================================
echo   BANCA EL CASTANO - COMPILADOR AUTOMATICO DE APK ANDROID
echo ========================================================================
echo.

cd /d "%~dp0"

where flutter >nul 2>&1
if %errorlevel% equ 0 (
  echo [*] Flutter SDK detectado. Compilando con Flutter...
  if not exist "android\gradlew.bat" (
    copy /Y "android\app\src\main\AndroidManifest.xml" "%TEMP%\banca_fc_manifest.bak" >nul
    call flutter create --platforms=android --project-name banca_fc_taquilla_app --org com.bancafc .
    copy /Y "%TEMP%\banca_fc_manifest.bak" "android\app\src\main\AndroidManifest.xml" >nul
  )
  call flutter pub get
  call flutter build apk --release
  echo.
  echo APK generado en: build\app\outputs\flutter-apk\app-release.apk
  pause
  exit /b 0
)

echo [*] Compilando APK nativo con Android Studio SDK instalado en este PC...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference = 'Stop'; " ^
  "$root = (Resolve-Path '..').Path; " ^
  "$jdkBin = 'C:\Program Files\Android\Android Studio\jbr\bin'; " ^
  "$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'; " ^
  "$env:PATH = \"$jdkBin;$env:PATH\"; " ^
  "$sdkDir = \"$env:LOCALAPPDATA\Android\Sdk\"; " ^
  "$bt = (Get-ChildItem \"$sdkDir\build-tools\" | Sort-Object Name -Descending | Select-Object -First 1).FullName; " ^
  "$plat = (Get-ChildItem \"$sdkDir\platforms\" | Sort-Object Name -Descending | Select-Object -First 1).FullName; " ^
  "$androidJar = \"$plat\android.jar\"; " ^
  "$workDir = \"$root\taquilla_flutter_app\android_native_builder\"; " ^
  "$outDir = \"$workDir\build_out\"; " ^
  "if (Test-Path $outDir) { Remove-Item -Recurse -Force $outDir }; " ^
  "New-Item -ItemType Directory -Path \"$outDir\classes\", \"$outDir\assets\" -Force | Out-Null; " ^
  "Copy-Item \"$root\app_movil\*\" \"$outDir\assets\" -Recurse -Force; " ^
  "& \"$jdkBin\javac.exe\" -source 1.8 -target 1.8 -bootclasspath $androidJar -classpath $androidJar -d \"$outDir\classes\" \"$workDir\MainActivity.java\"; " ^
  "$classFiles = Get-ChildItem \"$outDir\classes\com\bancafc\taquilla_app\*.class\" | ForEach-Object { $_.FullName }; " ^
  "& \"$bt\d8.bat\" --lib $androidJar --output \"$outDir\" $classFiles; " ^
  "& \"$bt\aapt2.exe\" link -o \"$outDir\unaligned.apk\" -I $androidJar --manifest \"$workDir\AndroidManifest.xml\" -A \"$outDir\assets\" --auto-add-overlay; " ^
  "Push-Location $outDir; & \"$jdkBin\jar.exe\" -uf 'unaligned.apk' 'classes.dex'; Pop-Location; " ^
  "& \"$bt\zipalign.exe\" -f -p 4 \"$outDir\unaligned.apk\" \"$outDir\aligned.apk\"; " ^
  "$ks = \"$workDir\bancafc_release.jks\"; " ^
  "$finalApk = \"$root\BancaFC-Taquilla-Android.apk\"; " ^
  "& \"$bt\apksigner.bat\" sign --ks $ks --ks-key-alias bancafc --ks-pass pass:bancafc2026 --key-pass pass:bancafc2026 --out $finalApk \"$outDir\aligned.apk\"; " ^
  "Remove-Item -Recurse -Force $outDir; " ^
  "Write-Host 'APK COMPILADO EXITOSAMENTE EN:' $finalApk"

pause
