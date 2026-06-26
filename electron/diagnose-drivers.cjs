"use strict";
const { exec } = require("child_process");

function ps(script) {
  return new Promise((resolve) => {
    exec(
      `powershell.exe -NoProfile -NonInteractive -Command "${script}"`,
      { timeout: 8000 },
      (err, stdout, stderr) => resolve({ err, stdout: stdout.trim(), stderr: stderr.trim() })
    );
  });
}

async function checkDrivers() {
  const result = {
    wifi: { operational: false, details: "" },
    bluetooth: { operational: false, details: "" },
  };

  // Wi-Fi check — query physical wireless adapters
  const wifi = await ps(
    "Get-NetAdapter | Where-Object { $_.PhysicalMediaType -like '*802.11*' -or $_.InterfaceDescription -like '*Wireless*' -or $_.InterfaceDescription -like '*Wi-Fi*' -or $_.InterfaceDescription -like '*WiFi*' } | Select-Object -First 3 Name,Status,LinkSpeed | ConvertTo-Json -Compress"
  );

  if (!wifi.err && wifi.stdout && wifi.stdout !== "null") {
    try {
      const adapters = [].concat(JSON.parse(wifi.stdout));
      const up = adapters.filter((a) => a.Status === "Up");
      result.wifi.operational = up.length > 0;
      result.wifi.details = adapters
        .map((a) => `${a.Name}: ${a.Status}${a.LinkSpeed ? " @ " + a.LinkSpeed : ""}`)
        .join("; ");
    } catch (_) {
      result.wifi.details = wifi.stdout.slice(0, 120);
    }
  } else {
    result.wifi.details = wifi.err ? wifi.err.message.slice(0, 100) : "No wireless adapters found";
  }

  // Bluetooth check — query PnP Bluetooth devices
  const bt = await ps(
    "Get-PnpDevice -Class Bluetooth -ErrorAction SilentlyContinue | Where-Object { $_.Status -ne $null } | Select-Object -First 3 FriendlyName,Status | ConvertTo-Json -Compress"
  );

  if (!bt.err && bt.stdout && bt.stdout !== "null") {
    try {
      const devices = [].concat(JSON.parse(bt.stdout));
      const ok = devices.filter((d) => d.Status === "OK");
      result.bluetooth.operational = ok.length > 0;
      result.bluetooth.details = devices
        .map((d) => `${d.FriendlyName}: ${d.Status}`)
        .join("; ");
    } catch (_) {
      result.bluetooth.details = bt.stdout.slice(0, 120);
    }
  } else {
    result.bluetooth.details = bt.err ? bt.err.message.slice(0, 100) : "No Bluetooth devices found";
  }

  return result;
}

module.exports = { checkDrivers };
