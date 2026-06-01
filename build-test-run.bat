@echo off
echo Starting test...
corepack pnpm test && echo "Test completed. Starting build..." && corepack pnpm build && echo "Build completed. Starting lint..." && corepack pnpm lint && "echo Lint completed. Starting development server..." && corepack pnpm dev
echo Build complete and development server stopped
pause > nul