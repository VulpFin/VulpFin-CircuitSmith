@echo off
setlocal

echo Starting development server...
call corepack pnpm dev
set "EXIT_CODE=%ERRORLEVEL%"

if "%EXIT_CODE%"=="0" (
    echo Development server stopped.
) else (
    echo Development server exited with code %EXIT_CODE%.
)

echo.
pause
endlocal & exit /b %EXIT_CODE%
