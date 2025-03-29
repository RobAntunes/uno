import SquirrelEvents from './app/events/squirrel.events';
import ElectronEvents from './app/events/electron.events';
import { app, BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron';
import App from './app/app';
import * as fs from 'fs/promises';
import * as path from 'path';
// import * as chokidar from 'chokidar'; // Removed

// Define types matching the renderer (can be shared in a common types file later)
interface FSEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}
interface DirectoryListing {
    path: string;
    entries: FSEntry[];
}

// --- IPC Handler for Reading Directory ---
// Using handle/invoke for async request/response
ipcMain.handle('read-directory', async (event: IpcMainInvokeEvent, requestedPath: string): Promise<DirectoryListing> => {
  console.log(`[Main Process] Received read-directory request for: ${requestedPath}`);

  // Basic security check: Resolve the path to ensure it's absolute and normalized.
  // Consider adding more robust path validation/sandboxing later based on your app's needs.
  // Resolve relative to app's CWD. Might need adjustment if you want it relative to user data, etc.
  const absolutePath = path.resolve(requestedPath || '.');
  console.log(`[Main Process] Resolved path to: ${absolutePath}`);

  try {
    const entries: FSEntry[] = [];
    const ignoredNames = new Set(['.git', 'node_modules', 'dist',


    ]); // Add folders to ignore here

    const dir = await fs.opendir(absolutePath);
    for await (const dirent of dir) {
      // Potentially filter out hidden files, specific types, etc.
      if (dirent.name.startsWith('.') && dirent.name !== '.') continue; // Keep ignoring hidden, except root itself if requested
      if (ignoredNames.has(dirent.name)) continue; // Skip ignored directories

      entries.push({
        name: dirent.name,
        // Important: Send back the *absolute* path for the next request
        path: path.join(absolutePath, dirent.name),
        isDirectory: dirent.isDirectory(),
      });
    }

    // Sort entries (optional, directories first, then alphabetically)
    entries.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) {
            return a.isDirectory ? -1 : 1; // Directories first
        }
        return a.name.localeCompare(b.name); // Then alphabetical
    });


    console.log(`[Main Process] Sending listing for ${absolutePath}`);
    return { path: absolutePath, entries: entries };

  } catch (error: any) {
    console.error(`[Main Process] Error reading directory ${absolutePath}:`, error);
    // Re-throw the error so the renderer's catch block receives it
    throw new Error(`Failed to read directory '${absolutePath}': ${error.message}`);
  }
});
// --- End IPC Handler ---

export default class Main {
  static initialize() {
    if (SquirrelEvents.handleEvents()) {
      // squirrel event handled (except first run event) and app will exit in 1000ms, so don't do anything else
      app.quit();
    }
  }

  static bootstrapApp() {
    App.main(app, BrowserWindow);
  }

  static bootstrapAppEvents() {
    ElectronEvents.bootstrapElectronEvents();

    // initialize auto updater service
    if (!App.isDevelopmentMode()) {
      // UpdateEvents.initAutoUpdateService();
    }
  }
}

// handle setup events as quickly as possible
Main.initialize();

// bootstrap app
Main.bootstrapApp();
Main.bootstrapAppEvents();

// --- Initialize Chokidar File Watcher ---
// NOTE: This initialization might ideally live within the App.main logic
// or be triggered after the main window is created and ready.
// Placing it here for now as a starting point.
// Ensure mainWindow is accessible if defined within App.main
// For now, we assume App.mainWindow holds the reference.

// Define the target directory to watch (replace '.' with your actual project root later)
// const watchPath = '.';
// console.log(`[Main Process] Initializing file watcher for path: ${watchPath}`);

// const watcher = chokidar.watch(watchPath, {
//   ignored: /(^|[/\\])\../, // ignore dotfiles - reverting to original pattern
//   persistent: true,
//   ignoreInitial: true, // Don't send events for files already present
//   depth: 99, // Adjust depth as needed, be mindful of performance on large trees
// });

// const sendFileChange = (eventType: string, filePath: string) => {
//   console.log(`[Main Process] File ${eventType}: ${filePath}`);
//   // Access the main window - THIS IS A GUESS based on common patterns.
//   // You MUST ensure 'App.mainWindow' or equivalent is correctly referenced.
//   const mainWindow = App.mainWindow; // Replace with actual reference if different
//   if (mainWindow && !mainWindow.isDestroyed()) {
//       mainWindow.webContents.send('file-changed', {
//           type: eventType,
//           path: filePath,
//       });
//   } else {
//       console.warn('[Main Process] Main window not available to send file-changed event.');
//   }
// };

// watcher
//   .on('add', (filePath) => sendFileChange('add', filePath))
//   .on('change', (filePath) => sendFileChange('change', filePath))
//   .on('unlink', (filePath) => sendFileChange('unlink', filePath))
//   .on('addDir', (filePath) => sendFileChange('addDir', filePath))
//   .on('unlinkDir', (filePath) => sendFileChange('unlinkDir', filePath))
//   .on('error', (error) => console.error(`[Main Process] Watcher error: ${error}`))
//   .on('ready', () => console.log('[Main Process] File watcher ready.'));

// --- End File Watcher Setup ---

// Ensure graceful shutdown of the watcher (optional but good practice)
app.on('before-quit', () => {
  // watcher.close().then(() => console.log('[Main Process] File watcher closed.')); // Old line
  App.fileWatcher?.close().then(() => console.log('[Main Process] File watcher closed via App class.')); // Updated line
});
