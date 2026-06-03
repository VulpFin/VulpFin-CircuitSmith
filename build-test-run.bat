@echo off
setlocal

echo Starting test...
call corepack pnpm test
set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" (
    echo Test failed with exit code %EXIT_CODE%.
    goto done
)

echo Test completed. Starting build...
call corepack pnpm build
set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" (
    echo Build failed with exit code %EXIT_CODE%.
    goto done
)

echo Build completed. Starting lint...
call corepack pnpm lint
set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" (
    echo Lint failed with exit code %EXIT_CODE%.
    goto done
)

echo Lint completed. Starting development server...
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
