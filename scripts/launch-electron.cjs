// Strips ELECTRON_RUN_AS_NODE (set by Claude Code / other Electron hosts)
// before spawning Electron so browser_init runs and the Electron API is available.
const { spawn } = require("child_process");
const path = require("path");
const electron = require("electron");

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const proc = spawn(electron, [path.resolve(__dirname, "..")], {
  stdio: "inherit",
  env,
});

proc.on("close", (code) => process.exit(code ?? 0));
proc.on("error", (err) => {
  console.error("Failed to launch Electron:", err.message);
  process.exit(1);
});
