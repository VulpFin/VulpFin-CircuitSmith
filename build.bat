@echo off
setlocal

echo Starting build...
call corepack pnpm build
set "EXIT_CODE=%ERRORLEVEL%"

if "%EXIT_CODE%"=="0" (
    echo Build completed.
) else (
    echo Build failed with exit code %EXIT_CODE%.
)

echo.
pause
endlocal & exit /b %EXIT_CODE%
