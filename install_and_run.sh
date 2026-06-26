#!/bin/bash

echo "==================================================="
echo "            EduAdmin Pro - School System"
echo "            Setting up your local server..."
echo "==================================================="
echo ""

# Step 1: Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed on this computer."
    echo "Node.js is required to run the EduAdmin Pro server."
    echo ""
    echo "Please visit https://nodejs.org/ and install the LTS version."
    echo "Once installed, run this script again."
    echo ""
    # Try to open the browser automatically
    if command -v open &> /dev/null; then
        open "https://nodejs.org/"
    elif command -v xdg-open &> /dev/null; then
        xdg-open "https://nodejs.org/"
    fi
    exit 1
fi
echo "[OK] Node.js detected: $(node -v)"
echo ""

# Step 2: Install packages if node_modules is missing
if [ ! -d "node_modules" ]; then
    echo "[INFO] First-time setup: downloading required packages..."
    echo "This may take a few minutes. Please wait."
    echo ""
    npm install
    if [ $? -ne 0 ]; then
        echo ""
        echo "[ERROR] Failed to install packages."
        echo "Please check your internet connection and try again."
        exit 1
    fi
    echo ""
    echo "[OK] Packages installed successfully."
else
    echo "[OK] Packages already installed. Skipping download."
fi
echo ""

# Step 3: Build the app if dist/server.cjs is missing
if [ ! -f "dist/server.cjs" ]; then
    echo "[INFO] First-time build: compiling the application..."
    echo "This may take up to a minute. Please wait."
    echo ""
    npm run build
    if [ $? -ne 0 ]; then
        echo ""
        echo "[ERROR] Build failed. Check the output above for details."
        exit 1
    fi
    echo ""
    echo "[OK] Application compiled successfully."
else
    echo "[OK] Application already built. Skipping compilation."
fi
echo ""

echo "==================================================="
echo "  Server is starting. Do NOT close this window."
echo "  Press Ctrl+C to stop the server."
echo "==================================================="
echo ""
echo "Opening EduAdmin Pro in your web browser..."
echo "If the page does not load, wait 3 seconds and refresh."
echo ""

# Step 4: Open browser (detect macOS vs Linux)
sleep 1
if [[ "$OSTYPE" == "darwin"* ]]; then
    open "http://localhost:3000"
else
    xdg-open "http://localhost:3000" &> /dev/null &
fi

# Step 5: Launch the production server
node dist/server.cjs
