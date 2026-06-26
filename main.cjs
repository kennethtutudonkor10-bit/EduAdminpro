const { app, BrowserWindow } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const net = require("net");
const fs = require("fs");

let mainWindow = null;
let serverProcess = null;
let serverPort = null;

// ── Logging ────────────────────────────────────────────────────────────────────
function writeLog(message) {
  try {
    const logsDir = path.join(app.getPath("userData"), "logs");
    fs.mkdirSync(logsDir, { recursive: true });
    fs.appendFileSync(
      path.join(logsDir, "app.log"),
      `[${new Date().toISOString()}] ${message}\n`
    );
  } catch (_) {}
}

// ── Port selection ─────────────────────────────────────────────────────────────
function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

// ── Server spawn + SERVER_READY handshake ──────────────────────────────────────
function startServer(port) {
  return new Promise((resolve) => {
    // server.cjs is listed in asarUnpack so electron-builder extracts it to
    // app.asar.unpacked — a real file on disk, no ASAR magic needed for the
    // subprocess entry point. Static assets stay inside app.asar (DIST_PATH below).
    const serverPath = app.isPackaged
      ? path.join(process.resourcesPath, "app.asar.unpacked", "dist", "server.cjs")
      : path.join(__dirname, "..", "dist", "server.cjs");

    writeLog(`Starting server: ${serverPath} on port ${port}`);

    // Use Electron's own binary as the Node runtime so we never depend on a
    // system-installed Node.js. ELECTRON_RUN_AS_NODE=1 puts it in plain Node
    // mode while keeping Electron's patched require() — which can read files
    // that live inside the app.asar archive.
    serverProcess = spawn(process.execPath, [serverPath], {
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "1",
        PORT: String(port),
        NODE_ENV: "production",
        USER_DATA: app.getPath("userData"),
        DIST_PATH: app.isPackaged
          ? path.join(process.resourcesPath, "app.asar", "dist")
          : path.join(__dirname, "..", "dist"),
      },
    });

    serverProcess.stdout.on("data", (data) => {
      const text = data.toString().trim();
      writeLog(`[server] ${text}`);
      if (text.includes("SERVER_READY")) {
        resolve();
      }
    });

    serverProcess.stderr.on("data", (data) => {
      writeLog(`[server:err] ${data.toString().trim()}`);
    });

    serverProcess.on("error", (err) => {
      writeLog(`Server spawn error: ${err.message}`);
      resolve(); // Still open the window so the user sees what went wrong
    });

    serverProcess.on("close", (code) => {
      writeLog(`Server exited (code ${code})`);
    });

    // Fallback: open the window after 6 s even if SERVER_READY never arrives
    setTimeout(resolve, 6000);
  });
}

// ── Graceful shutdown ──────────────────────────────────────────────────────────
function killServer() {
  if (serverProcess) {
    writeLog("Killing server process");
    try { serverProcess.kill(); } catch (_) {}
    serverProcess = null;
  }
}

// ── Window ─────────────────────────────────────────────────────────────────────
function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "EduAdmin Pro",
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL(`http://127.0.0.1:${port}`);
  writeLog(`Window opened at http://127.0.0.1:${port}`);

  // Retry if the server wasn't ready yet — but cap at 8 attempts (~12 s total)
  let loadRetries = 0;
  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDesc) => {
    if ((errorCode === -102 || errorCode === -6) && loadRetries < 8) {
      loadRetries++;
      writeLog(`Page load failed (${errorDesc}), retrying in 1.5s`);
      setTimeout(() => {
        if (mainWindow) mainWindow.loadURL(`http://127.0.0.1:${port}`);
      }, 1500);
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ── Lifecycle ──────────────────────────────────────────────────────────────────
app.on("ready", async () => {
  writeLog("App ready — finding free port");
  try {
    serverPort = await findFreePort();
    writeLog(`Using port ${serverPort}`);
    await startServer(serverPort);
    writeLog("SERVER_READY received — opening window");
    createWindow(serverPort);
  } catch (err) {
    writeLog(`Startup failed: ${err.message}`);
  }
});

app.on("window-all-closed", () => {
  killServer();
  app.quit();
});

app.on("before-quit", killServer);

// macOS: re-open window on dock click when no windows are open
app.on("activate", () => {
  if (mainWindow === null && serverPort) {
    createWindow(serverPort);
  }
});
