@echo off
setlocal

echo Starting build...
call corepack pnpm build
set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" (
    echo Build failed with exit code %EXIT_CODE%.
    goto done
)

echo Build completed. Starting development server...
call corepack pnpm dev
set "EXIT_CODE=%ERRORLEVEL%"

if "%EXIT_CODE%"=="0" (
    echo Development server stopped.
) else (
    echo Development server exited with code %EXIT_CODE%.
)

:done
echo.
pause
endlocal & exit /b %EXIT_CODE%
