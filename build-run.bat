@echo off
echo Starting build and development server...
corepack pnpm build && corepack pnpm dev
echo Build and development server completed.
pause > nul