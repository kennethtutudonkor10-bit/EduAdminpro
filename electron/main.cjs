// ── Boot-time crash capture ────────────────────────────────────────────────
// Must be the very first code — catches errors thrown during any require().
const path = require("path");
const fs = require("fs");
const os = require("os");

const BOOT_LOG = path.join(os.homedir(), "eduadmin-boot-error.log");

function forceLog(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try { fs.appendFileSync(BOOT_LOG, line); } catch (_) {}
}

process.on("uncaughtException", (err) => {
  forceLog(`[UNCAUGHT] ${err.stack || err}`);
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  forceLog(`[REJECTION] ${reason}`);
});

// ── Electron ───────────────────────────────────────────────────────────────
const { app, BrowserWindow } = require("electron");
const { checkDrivers } = require("./diagnose-drivers.cjs");
const { spawn } = require("child_process");
const net = require("net");
const http = require("http");

// Guard required: dev-mode GPU/renderer sub-processes also load this file
// with require("electron").app === undefined.
if (app) app.disableHardwareAcceleration();

let mainWindow = null;
let serverProcess = null;
let serverPort = null;

// ── Logging ────────────────────────────────────────────────────────────────
function writeLog(msg) {
  forceLog(msg);
  if (!app) return;
  try {
    const logsDir = path.join(app.getPath("userData"), "logs");
    fs.mkdirSync(logsDir, { recursive: true });
    fs.appendFileSync(path.join(logsDir, "app.log"), `[${new Date().toISOString()}] ${msg}\n`);
  } catch (_) {}
}

// ── Port selection ─────────────────────────────────────────────────────────
function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

// ── Server spawn + HTTP health-poll ───────────────────────────────────────
function startServer(port) {
  return new Promise((resolve) => {
    // extraResources places dist/ directly at resources/dist — no ASAR indirection.
    // better-sqlite3 lands at resources/node_modules/ (same extraResources strategy)
    // so Node's resolver finds it by walking up from resources/dist/.
    const serverPath = app.isPackaged
      ? path.join(process.resourcesPath, "dist", "server.cjs")
      : path.join(__dirname, "..", "dist", "server.cjs");

    writeLog(`Starting server: ${serverPath} on port ${port}`);

    serverProcess = spawn(process.execPath, [serverPath], {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "1",
        PORT: String(port),
        NODE_ENV: "production",
        USER_DATA: app.getPath("userData"),
        DIST_PATH: app.isPackaged
          ? path.join(process.resourcesPath, "dist")
          : path.join(__dirname, "..", "dist"),
      },
    });

    serverProcess.stdout.on("data", (d) => writeLog(`[server] ${d.toString().trim()}`));
    serverProcess.stderr.on("data", (d) => writeLog(`[server:err] ${d.toString().trim()}`));
    serverProcess.on("error", (err) => { writeLog(`Spawn error: ${err.message}`); resolve(); });
    serverProcess.on("close", (code) => writeLog(`Server exited (code ${code})`));

    let resolved = false;
    const done = () => { if (!resolved) { resolved = true; resolve(); } };

    // Poll /api/health — immune to Windows stdout-pipe buffering delays.
    const poll = () => {
      if (resolved) return;
      http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
        if (res.statusCode === 200) { writeLog("Server healthy — opening window"); done(); }
        else setTimeout(poll, 300);
        res.resume();
      }).on("error", () => setTimeout(poll, 300));
    };
    setTimeout(poll, 500);
    setTimeout(done, 12000); // Absolute fallback
  });
}

// ── Graceful shutdown ──────────────────────────────────────────────────────
function killServer() {
  if (serverProcess) {
    try { serverProcess.kill(); } catch (_) {}
    serverProcess = null;
  }
}

// ── Window ─────────────────────────────────────────────────────────────────
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

  let retries = 0;
  mainWindow.webContents.on("did-fail-load", (_e, code, desc) => {
    if ((code === -102 || code === -6) && retries < 8) {
      retries++;
      writeLog(`Load failed (${desc}), retry ${retries}`);
      setTimeout(() => { if (mainWindow) mainWindow.loadURL(`http://127.0.0.1:${port}`); }, 1500);
    }
  });

  mainWindow.webContents.on("render-process-gone", (_e, details) => {
    writeLog(`Renderer gone: ${details.reason}`);
  });

  mainWindow.on("closed", () => { mainWindow = null; });
}

// ── Lifecycle ──────────────────────────────────────────────────────────────
// All app.on() calls are inside this guard so GPU/renderer sub-processes
// that load this file in dev mode do not crash when app is undefined.
if (app) {
  app.on("ready", async () => {
    writeLog("App ready");
    checkDrivers().then((drivers) => {
      writeLog(`[drivers] wifi=${drivers.wifi.operational ? "OK" : "FAIL"} | ${drivers.wifi.details}`);
      writeLog(`[drivers] bluetooth=${drivers.bluetooth.operational ? "OK" : "FAIL"} | ${drivers.bluetooth.details}`);
    }).catch((e) => writeLog(`[drivers] error: ${e.message}`));
    try {
      serverPort = await findFreePort();
      writeLog(`Port: ${serverPort}`);
      await startServer(serverPort);
      writeLog("Server ready — creating window");
      createWindow(serverPort);
    } catch (err) {
      writeLog(`Startup error: ${err.message}`);
    }
  });

  app.on("window-all-closed", () => { killServer(); app.quit(); });
  app.on("before-quit", killServer);
  app.on("activate", () => { if (!mainWindow && serverPort) createWindow(serverPort); });
}
