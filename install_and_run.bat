@echo off
title EduAdmin Pro - Setup ^& Launcher
echo ===================================================
echo             EduAdmin Pro - School System
echo             Setting up your local server...
echo ===================================================
echo.

:: Step 1: Check if Node.js is installed
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed on this computer.
    echo Node.js is required to run the EduAdmin Pro server.
    echo.
    echo Opening your web browser to download Node.js...
    start "" "https://nodejs.org/"
    echo.
    echo Please download and install the "LTS" version of Node.js.
    echo Once installed, close this window and double-click
    echo "install_and_run.bat" again to continue.
    echo.
    pause
    exit
)
echo [OK] Node.js detected.
echo.

:: Step 2: Install packages if node_modules is missing
if not exist node_modules\ (
    echo [INFO] First-time setup: downloading required packages...
    echo This may take a few minutes. Please wait.
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] Failed to install packages.
        echo Please check your internet connection and try again.
        pause
        exit
    )
    echo.
    echo [OK] Packages installed successfully.
) else (
    echo [OK] Packages already installed. Skipping download.
)
echo.

:: Step 3: Build the app if dist/server.cjs is missing
if not exist dist\server.cjs (
    echo [INFO] First-time build: compiling the application...
    echo This may take up to a minute. Please wait.
    echo.
    call npm run build
    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] Build failed. Please check the output above for details.
        pause
        exit
    )
    echo.
    echo [OK] Application compiled successfully.
) else (
    echo [OK] Application already built. Skipping compilation.
)
echo.

echo ===================================================
echo   Server is starting. Do NOT close this window.
echo   To stop the server, close this window.
echo ===================================================
echo.
echo Opening EduAdmin Pro in your web browser...
echo If the page does not load, wait 3 seconds and refresh.
echo.

:: Step 4: Open browser and launch the production server
start "" "http://localhost:3000"
node dist\server.cjs

pause
