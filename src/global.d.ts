// Ambient global type augmentations.

export {};

declare global {
  interface Window {
    // Optionally injected by an Electron preload script. The packaged app
    // currently runs with contextIsolation and no preload, so this is
    // undefined at runtime and callers fall back to window.close().
    electron?: {
      quit?: () => void;
    };
  }
}
