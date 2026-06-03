@echo off
setlocal

echo Starting test...
call corepack pnpm test
set "EXIT_CODE=%ERRORLEVEL%"

if "%EXIT_CODE%"=="0" (
    echo Test completed.
) else (
    echo Test failed with exit code %EXIT_CODE%.
)

echo.
pause
endlocal & exit /b %EXIT_CODE%
