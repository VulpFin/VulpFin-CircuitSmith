@echo off
setlocal

rem Usage:
rem   gitpush.bat "commit message"
rem   gitpush.bat "commit message" file1 folder2
rem   gitpush.bat
rem
rem If no files/folders are specified, it stages everything.

set "COMMIT_MSG=%~1"

if "%COMMIT_MSG%"=="" (
    set /p "COMMIT_MSG=Commit message: "
)

if "%COMMIT_MSG%"=="" (
    echo No commit message provided. Aborting.
    endlocal & exit /b 1
)

shift

if "%~1"=="" (
    echo Staging all changes...
    git add .
    if errorlevel 1 goto failed
) else (
    echo Staging specified files/folders...
    :add_loop
    if "%~1"=="" goto done_add
    git add "%~1"
    if errorlevel 1 goto failed
    shift
    goto add_loop
)

:done_add
git diff --cached --quiet
if not errorlevel 1 (
    echo No staged changes to commit.
    endlocal & exit /b 0
)

echo Committing...
git commit -m "%COMMIT_MSG%"
if errorlevel 1 goto failed

echo Pushing...
git push
if errorlevel 1 goto failed

echo Done.
endlocal & exit /b 0

:failed
set "EXIT_CODE=%ERRORLEVEL%"
echo Command failed with exit code %EXIT_CODE%.
endlocal & exit /b %EXIT_CODE%
