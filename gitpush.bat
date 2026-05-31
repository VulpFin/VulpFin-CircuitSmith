@echo off
setlocal enabledelayedexpansion

REM Usage:
REM   gitpush.bat "commit message"
REM   gitpush.bat "commit message" file1 folder2
REM   gitpush.bat
REM
REM If no files/folders are specified, it stages everything.

set "COMMIT_MSG=%~1"

if "%COMMIT_MSG%"=="" (
    set /p COMMIT_MSG=Commit message: 
)

if "%COMMIT_MSG%"=="" (
    echo No commit message provided. Aborting.
    exit /b 1
)

shift

if "%~1"=="" (
    echo Staging all changes...
    git add .
) else (
    echo Staging specified files/folders...
    :add_loop
    if "%~1"=="" goto done_add
    git add "%~1"
    shift
    goto add_loop
)

:done_add

echo Committing...
git commit -m "%COMMIT_MSG%"

echo Pushing...
git push

echo Done.
endlocal