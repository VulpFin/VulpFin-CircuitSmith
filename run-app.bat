@echo off
setlocal
pushd "%~dp0" >nul

set "APP_URL=http://localhost:5173"
set "FALLBACK_APP_URL=http://127.0.0.1:5173"
set "PROFILE_DIR=%LOCALAPPDATA%\VulpFin CircuitSmith\AppBrowserProfile"
set "BROWSER_EXE="
set "BROWSER_NAME="
set "SERVER_STARTED=0"
set "SERVER_PID="
set "APP_EXIT_CODE=0"

if defined VFCS_APP_URL set "APP_URL=%VFCS_APP_URL%"

if /I "%~1"=="--dry-run" goto dry_run

echo Checking VulpFin CircuitSmith dev server...
call :server_ready
if errorlevel 1 (
    echo Dev server is not running. Starting it in a minimized terminal...
    call :start_dev_server
    if errorlevel 1 goto failed
    call :wait_for_server
    if errorlevel 1 goto failed
) else (
    echo Dev server is already running.
)

call :find_browser
if "%BROWSER_EXE%"=="" (
    echo Could not find a dedicated app-capable browser.
    echo Recommended options: Chromium, Ungoogled Chromium, Brave, Vivaldi, or Thorium.
    echo.
    echo Portable option: put a Chromium-style browser at one of these paths:
    echo   tools\chromium\chrome.exe
    echo   tools\ungoogled-chromium\chrome.exe
    echo.
    echo You can also set VFCS_APP_BROWSER to a browser .exe path before running this:
    echo   set "VFCS_APP_BROWSER=C:\Path\To\chromium.exe"
    echo   .\run-app.bat
    goto failed
)

if not exist "%PROFILE_DIR%" mkdir "%PROFILE_DIR%"

echo Opening dedicated app window with %BROWSER_NAME%...
start "VFCS App" /wait "%BROWSER_EXE%" --app="%APP_URL%" --user-data-dir="%PROFILE_DIR%" --no-first-run --disable-extensions --window-size=1600,1000
set "APP_EXIT_CODE=%ERRORLEVEL%"
echo App window closed.
if "%SERVER_STARTED%"=="1" call :stop_dev_server
popd >nul
endlocal & exit /b %APP_EXIT_CODE%

:server_ready
call :url_ready "%APP_URL%"
if not errorlevel 1 exit /b 0

if /I not "%APP_URL%"=="%FALLBACK_APP_URL%" (
    call :url_ready "%FALLBACK_APP_URL%"
    if not errorlevel 1 (
        set "APP_URL=%FALLBACK_APP_URL%"
        exit /b 0
    )
)

exit /b 1

:url_ready
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $response = Invoke-WebRequest -UseBasicParsing -Uri '%~1' -TimeoutSec 2; if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) { exit 0 } } catch { }; exit 1"
exit /b %ERRORLEVEL%

:start_dev_server
set "SERVER_PID_FILE=%TEMP%\vfcs-dev-server-%RANDOM%%RANDOM%.pid"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$command = 'Set-Location -LiteralPath ''%CD%''; corepack pnpm dev'; $process = Start-Process -FilePath 'powershell.exe' -WindowStyle Minimized -PassThru -ArgumentList @('-NoProfile', '-NoExit', '-ExecutionPolicy', 'Bypass', '-Command', $command); Set-Content -LiteralPath '%SERVER_PID_FILE%' -Value $process.Id"
if errorlevel 1 exit /b 1

if exist "%SERVER_PID_FILE%" (
    set /p SERVER_PID=<"%SERVER_PID_FILE%"
    del "%SERVER_PID_FILE%" >nul 2>nul
)

if "%SERVER_PID%"=="" (
    echo Could not capture dev server PowerShell PID.
    exit /b 1
)

set "SERVER_STARTED=1"
echo Dev server PowerShell PID: %SERVER_PID%
exit /b 0

:stop_dev_server
if "%SERVER_PID%"=="" exit /b 0
echo Closing dev server PowerShell...
taskkill /PID %SERVER_PID% /T /F >nul 2>nul
if errorlevel 1 (
    echo Dev server PowerShell was already closed or could not be stopped.
) else (
    echo Dev server PowerShell closed.
)
set "SERVER_STARTED=0"
exit /b 0

:wait_for_server
echo Waiting for %APP_URL%...
for /L %%I in (1,1,45) do (
    call :server_ready
    if not errorlevel 1 exit /b 0
    timeout /t 1 /nobreak >nul
)
echo Dev server did not become ready in time.
exit /b 1

:find_browser
if defined VFCS_APP_BROWSER (
    if exist "%VFCS_APP_BROWSER%" (
        set "BROWSER_EXE=%VFCS_APP_BROWSER%"
        set "BROWSER_NAME=custom browser"
        exit /b 0
    )
    echo VFCS_APP_BROWSER is set, but the file was not found:
    echo   %VFCS_APP_BROWSER%
    echo.
)

if exist "%~dp0tools\ungoogled-chromium\chrome.exe" (
    set "BROWSER_NAME=portable Ungoogled Chromium"
    set "BROWSER_EXE=%~dp0tools\ungoogled-chromium\chrome.exe"
    exit /b 0
)
if exist "%~dp0tools\chromium\chrome.exe" (
    set "BROWSER_NAME=portable Chromium"
    set "BROWSER_EXE=%~dp0tools\chromium\chrome.exe"
    exit /b 0
)
if exist "%~dp0portable\ungoogled-chromium\chrome.exe" (
    set "BROWSER_NAME=portable Ungoogled Chromium"
    set "BROWSER_EXE=%~dp0portable\ungoogled-chromium\chrome.exe"
    exit /b 0
)
if exist "%~dp0portable\chromium\chrome.exe" (
    set "BROWSER_NAME=portable Chromium"
    set "BROWSER_EXE=%~dp0portable\chromium\chrome.exe"
    exit /b 0
)

if exist "%ProgramFiles%\ungoogled-chromium\chrome.exe" (
    set "BROWSER_NAME=Ungoogled Chromium"
    set "BROWSER_EXE=%ProgramFiles%\ungoogled-chromium\chrome.exe"
    exit /b 0
)
if exist "%ProgramFiles(x86)%\ungoogled-chromium\chrome.exe" (
    set "BROWSER_NAME=Ungoogled Chromium"
    set "BROWSER_EXE=%ProgramFiles(x86)%\ungoogled-chromium\chrome.exe"
    exit /b 0
)
if exist "%LOCALAPPDATA%\Programs\ungoogled-chromium\chrome.exe" (
    set "BROWSER_NAME=Ungoogled Chromium"
    set "BROWSER_EXE=%LOCALAPPDATA%\Programs\ungoogled-chromium\chrome.exe"
    exit /b 0
)
if exist "%LOCALAPPDATA%\ungoogled-chromium\chrome.exe" (
    set "BROWSER_NAME=Ungoogled Chromium"
    set "BROWSER_EXE=%LOCALAPPDATA%\ungoogled-chromium\chrome.exe"
    exit /b 0
)

if exist "%ProgramFiles%\Chromium\Application\chrome.exe" (
    set "BROWSER_NAME=Chromium"
    set "BROWSER_EXE=%ProgramFiles%\Chromium\Application\chrome.exe"
    exit /b 0
)
if exist "%ProgramFiles(x86)%\Chromium\Application\chrome.exe" (
    set "BROWSER_NAME=Chromium"
    set "BROWSER_EXE=%ProgramFiles(x86)%\Chromium\Application\chrome.exe"
    exit /b 0
)
if exist "%LOCALAPPDATA%\Chromium\Application\chrome.exe" (
    set "BROWSER_NAME=Chromium"
    set "BROWSER_EXE=%LOCALAPPDATA%\Chromium\Application\chrome.exe"
    exit /b 0
)
if exist "%ProgramFiles%\Chromium\chrome.exe" (
    set "BROWSER_NAME=Chromium"
    set "BROWSER_EXE=%ProgramFiles%\Chromium\chrome.exe"
    exit /b 0
)
if exist "%ProgramFiles(x86)%\Chromium\chrome.exe" (
    set "BROWSER_NAME=Chromium"
    set "BROWSER_EXE=%ProgramFiles(x86)%\Chromium\chrome.exe"
    exit /b 0
)
if exist "%LOCALAPPDATA%\Programs\Chromium\chrome.exe" (
    set "BROWSER_NAME=Chromium"
    set "BROWSER_EXE=%LOCALAPPDATA%\Programs\Chromium\chrome.exe"
    exit /b 0
)

if exist "%ProgramFiles%\BraveSoftware\Brave-Browser\Application\brave.exe" (
    set "BROWSER_NAME=Brave"
    set "BROWSER_EXE=%ProgramFiles%\BraveSoftware\Brave-Browser\Application\brave.exe"
    exit /b 0
)
if exist "%ProgramFiles(x86)%\BraveSoftware\Brave-Browser\Application\brave.exe" (
    set "BROWSER_NAME=Brave"
    set "BROWSER_EXE=%ProgramFiles(x86)%\BraveSoftware\Brave-Browser\Application\brave.exe"
    exit /b 0
)
if exist "%LOCALAPPDATA%\BraveSoftware\Brave-Browser\Application\brave.exe" (
    set "BROWSER_NAME=Brave"
    set "BROWSER_EXE=%LOCALAPPDATA%\BraveSoftware\Brave-Browser\Application\brave.exe"
    exit /b 0
)

if exist "%ProgramFiles%\Vivaldi\Application\vivaldi.exe" (
    set "BROWSER_NAME=Vivaldi"
    set "BROWSER_EXE=%ProgramFiles%\Vivaldi\Application\vivaldi.exe"
    exit /b 0
)
if exist "%ProgramFiles(x86)%\Vivaldi\Application\vivaldi.exe" (
    set "BROWSER_NAME=Vivaldi"
    set "BROWSER_EXE=%ProgramFiles(x86)%\Vivaldi\Application\vivaldi.exe"
    exit /b 0
)
if exist "%LOCALAPPDATA%\Vivaldi\Application\vivaldi.exe" (
    set "BROWSER_NAME=Vivaldi"
    set "BROWSER_EXE=%LOCALAPPDATA%\Vivaldi\Application\vivaldi.exe"
    exit /b 0
)

if exist "%ProgramFiles%\Thorium\Application\thorium.exe" (
    set "BROWSER_NAME=Thorium"
    set "BROWSER_EXE=%ProgramFiles%\Thorium\Application\thorium.exe"
    exit /b 0
)
if exist "%ProgramFiles(x86)%\Thorium\Application\thorium.exe" (
    set "BROWSER_NAME=Thorium"
    set "BROWSER_EXE=%ProgramFiles(x86)%\Thorium\Application\thorium.exe"
    exit /b 0
)
if exist "%LOCALAPPDATA%\Thorium\Application\thorium.exe" (
    set "BROWSER_NAME=Thorium"
    set "BROWSER_EXE=%LOCALAPPDATA%\Thorium\Application\thorium.exe"
    exit /b 0
)

where chromium.exe >nul 2>nul
if not errorlevel 1 (
    for /f "delims=" %%B in ('where chromium.exe') do (
        set "BROWSER_EXE=%%B"
        set "BROWSER_NAME=Chromium"
        exit /b 0
    )
)

where brave.exe >nul 2>nul
if not errorlevel 1 (
    for /f "delims=" %%B in ('where brave.exe') do (
        set "BROWSER_EXE=%%B"
        set "BROWSER_NAME=Brave"
        exit /b 0
    )
)

where vivaldi.exe >nul 2>nul
if not errorlevel 1 (
    for /f "delims=" %%B in ('where vivaldi.exe') do (
        set "BROWSER_EXE=%%B"
        set "BROWSER_NAME=Vivaldi"
        exit /b 0
    )
)

where thorium.exe >nul 2>nul
if not errorlevel 1 (
    for /f "delims=" %%B in ('where thorium.exe') do (
        set "BROWSER_EXE=%%B"
        set "BROWSER_NAME=Thorium"
        exit /b 0
    )
)

exit /b 0

:dry_run
echo Dry run: checking which dedicated app browser would be used...
call :find_browser
if "%BROWSER_EXE%"=="" (
    echo No dedicated app-capable browser was found.
    echo Recommended options: Chromium, Ungoogled Chromium, Brave, Vivaldi, or Thorium.
    echo Portable option: tools\chromium\chrome.exe or tools\ungoogled-chromium\chrome.exe
    popd >nul
    endlocal & exit /b 1
)
echo Browser: %BROWSER_NAME%
echo Path: %BROWSER_EXE%
echo URL: %APP_URL%
echo Profile: %PROFILE_DIR%
popd >nul
endlocal & exit /b 0

:failed
echo.
if "%SERVER_STARTED%"=="1" call :stop_dev_server
pause
popd >nul
endlocal & exit /b 1
