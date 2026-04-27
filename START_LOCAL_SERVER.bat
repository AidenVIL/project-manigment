@echo off
REM Start Local Sponsor CRM Server with Ollama
REM This script starts Ollama and the Node.js server on your PC

echo.
echo ========================================
echo   Sponsor CRM - Local Server Startup
echo ========================================
echo.

REM Check if Ollama is installed
where ollama >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Ollama is not installed or not in PATH
    echo Download from: https://ollama.ai
    echo.
    pause
    exit /b 1
)

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Download from: https://nodejs.org
    echo.
    pause
    exit /b 1
)

echo [1/4] Checking Ollama installation...
ollama --version

echo.
echo [2/4] Starting Ollama service...
echo Launching: ollama serve
start "Ollama Server" cmd /k ollama serve

REM Wait for Ollama to start
timeout /t 3 /nobreak

echo.
echo [3/4] Pulling Mistral model (if not already present)...
echo This may take a few minutes on first run...
ollama pull mistral

echo.
echo [4/4] Starting Sponsor CRM application...
cd /d "%~dp0"

REM Set environment variables for local Ollama
set USE_OLLAMA=true
set OLLAMA_ENDPOINT=http://localhost:11434
set OLLAMA_MODEL=mistral
set PORT=3000
set GEMINI_API_KEY=

echo Environment variables set:
echo   USE_OLLAMA=%USE_OLLAMA%
echo   OLLAMA_ENDPOINT=%OLLAMA_ENDPOINT%
echo   OLLAMA_MODEL=%OLLAMA_MODEL%
echo   PORT=%PORT%
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
)

echo.
echo ========================================
echo   Server Starting...
echo ========================================
echo.
echo Access the app at: http://localhost:3000
echo.
echo Press Ctrl+C in this window to stop the server
echo.

REM Start the Node server
call node server.mjs

REM If we get here, the server crashed
echo.
echo ERROR: Server stopped unexpectedly
echo Check the error message above
pause
