@echo off
setlocal

set "LAST_EXIT_CODE=0"

:loop
echo Starting build...
call corepack pnpm build
set "LAST_EXIT_CODE=%ERRORLEVEL%"

if not "%LAST_EXIT_CODE%"=="0" (
    echo Build failed with exit code %LAST_EXIT_CODE%.
) else (
    echo Build completed. Starting development server...
    call corepack pnpm dev
    set "LAST_EXIT_CODE=%ERRORLEVEL%"

    if "%LAST_EXIT_CODE%"=="0" (
        echo Development server stopped.
    ) else (
        echo Development server exited with code %LAST_EXIT_CODE%.
    )
)

echo.
choice /C RE /N /M "Build and run again? [R]un again / [E]xit: "
if errorlevel 2 goto end
echo.
goto loop

:end
echo Exiting build-run loop.
endlocal & exit /b %LAST_EXIT_CODE%
