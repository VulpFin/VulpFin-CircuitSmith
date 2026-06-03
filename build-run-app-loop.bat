@echo off
setlocal

set "LAST_EXIT_CODE=0"
pushd "%~dp0" >nul

:loop
echo Starting build...
call corepack pnpm build
set "LAST_EXIT_CODE=%ERRORLEVEL%"

if not "%LAST_EXIT_CODE%"=="0" (
    echo Build failed with exit code %LAST_EXIT_CODE%.
) else (
    echo Build completed. Launching dedicated app window...
    call "%~dp0run-app.bat"
    set "LAST_EXIT_CODE=%ERRORLEVEL%"

    if "%LAST_EXIT_CODE%"=="0" (
        echo App launch completed.
    ) else (
        echo App launcher exited with code %LAST_EXIT_CODE%.
    )
)

echo.
choice /C RE /N /M "Build and launch app again? [R]un again / [E]xit: "
if errorlevel 2 goto end
echo.
goto loop

:end
echo Exiting build-run-app loop.
popd >nul
endlocal & exit /b %LAST_EXIT_CODE%
