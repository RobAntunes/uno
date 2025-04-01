import { BrowserWindow, screen } from 'electron';
import { rendererAppName } from './constants';
import { environment } from '../environments/environment';
import { join } from 'node:path';
import * as chokidar from 'chokidar';
import { launchIndexingService } from '../main';

export default class App {
  // Keep a global reference of the window object, if you don't, the window will
  // be closed automatically when the JavaScript object is garbage collected.
  static mainWindow: Electron.BrowserWindow | null;
  static application: Electron.App;
  static BrowserWindow: typeof BrowserWindow;
  static fileWatcher: chokidar.FSWatcher | null = null;

  public static isDevelopmentMode() {
    const isEnvironmentSet: boolean = 'ELECTRON_IS_DEV' in process.env;
    const getFromEnvironment: boolean =
      parseInt(process.env.ELECTRON_IS_DEV || '0', 10) === 1;

    return isEnvironmentSet ? getFromEnvironment : !environment.production;
  }

  private static initFileWatcher() {
    if (App.fileWatcher) {
      console.log('[App Class] File watcher already initialized.');
      return;
    }

    const watchPath = '.';
    console.log(`[App Class] Initializing file watcher. CWD: ${process.cwd()}, Watch Path: ${watchPath}`);

    // Define ignored paths using a function or array of globs for more control
    const ignoredPaths = [
      '**/.git/**',         // Ignore all git files/folders
      '**/node_modules/**', // Ignore all node_modules folders
      '**/.nx/**',          // Ignore the Nx cache/config directory
      '**/.lancedb/**',     // Ignore the LanceDB data directory
      '**/dist/**',         // Ignore build output directories
      '**/.angular/**',    // Ignore Angular cache
      '**/.cache/**',       // Ignore general cache folders
      '**/.idea/**',        // Ignore JetBrains IDE folders
      '**/.vscode/**',      // Ignore VSCode folders
      '**/out/**',          // Ignore other potential build outputs
      /(^|[/\\])\.+/,     // Ignore hidden files/folders (dotfiles/dotfolders) like .env
    ];

    App.fileWatcher = chokidar.watch(watchPath, {
      // ignored: /(^|[/\\])\../, // Original pattern - less comprehensive
      ignored: ignoredPaths,    // Use the array of ignored patterns
      persistent: true,
      ignoreInitial: true,    // Don't send events for files already present
      depth: 15,              // REDUCE DEPTH from 99
      awaitWriteFinish: {     // Try to reduce events for rapidly changing files
        stabilityThreshold: 500,
        pollInterval: 100
      }
    });

    const sendFileChange = (eventType: string, filePath: string) => {
      console.log(`[App Class] File ${eventType}: ${filePath}`);
      if (App.mainWindow && !App.mainWindow.isDestroyed()) {
          App.mainWindow.webContents.send('file-changed', {
              type: eventType,
              path: filePath,
          });
      } else {
          console.warn('[App Class] Main window not available to send file-changed event.');
      }
    };

    App.fileWatcher
      .on('add', (filePath) => sendFileChange('add', filePath))
      .on('change', (filePath) => sendFileChange('change', filePath))
      .on('unlink', (filePath) => sendFileChange('unlink', filePath))
      .on('addDir', (filePath) => sendFileChange('addDir', filePath))
      .on('unlinkDir', (filePath) => sendFileChange('unlinkDir', filePath))
      .on('error', (error) => console.error(`[App Class] Watcher error: ${error}`))
      .on('ready', () => console.log('[App Class] File watcher ready.'));

  }

  private static onWindowAllClosed() {
    if (process.platform !== 'darwin') {
      App.application.quit();
    }
  }

  private static async onReady() {
    console.log("[App Class] onReady - Entering");
    // Launch the indexing service
    try {
        console.log("[App Class] onReady - Calling launchIndexingService...");
        launchIndexingService(); // Launch the service process
        console.log("[App Class] onReady - launchIndexingService finished (service launching asynchronously).");
        // We no longer await direct initialization here
        // await initializeMainVectorStore(); // REMOVE or COMMENT OUT this line
    } catch (error) {
        console.error("[App Class] Failed to launch indexing service during onReady:", error);
    }

    // Proceed with window creation (no changes needed here)
    if (rendererAppName) {
      App.initMainWindow();
      App.loadMainWindow();
      App.initFileWatcher();
    } else {
        console.error('[App Class] Renderer app name not set.');
    }
    console.log("[App Class] onReady - Exiting");
  }

  private static onActivate() {
    if (App.mainWindow === null) {
      App.onReady();
    }
  }

  private static initMainWindow() {
    const workAreaSize = screen.getPrimaryDisplay().workAreaSize;
    const width = Math.min(1280, workAreaSize.width || 1280);
    const height = Math.min(720, workAreaSize.height || 720);

    App.mainWindow = new BrowserWindow({
      width: width,
      height: height,
      show: false,
      webPreferences: {
        contextIsolation: true,
        backgroundThrottling: false,
        preload: join(__dirname, 'main.preload.js'),
      },
    });
    App.mainWindow.setMenu(null);
    App.mainWindow.center();

    App.mainWindow.once('ready-to-show', () => {
      App.mainWindow?.show();
    });

    App.mainWindow.on('closed', () => {
      App.mainWindow = null;
    });
  }

  private static loadMainWindow() {
    // Determine the port: Use VITE_PORT env var if available, otherwise default (e.g., 4201)
    const port = process.env.VITE_PORT || '4201';
    const isDevelopment = !App.application.isPackaged;
    const url = isDevelopment
      ? `http://localhost:${port}` // Use dynamic port for dev
      : join(__dirname, `../renderer/${rendererAppName}/index.html`);

    console.log(`[App Class] Loading main window URL: ${url}`);

    if (isDevelopment) {
      App.mainWindow?.loadURL(url);
    } else {
      App.mainWindow?.loadFile(url);
    }
  }

  static main(app: Electron.App, browserWindow: typeof BrowserWindow) {
    App.BrowserWindow = browserWindow;
    App.application = app;

    App.application.on('window-all-closed', App.onWindowAllClosed);
    App.application.on('ready', App.onReady);
    App.application.on('activate', App.onActivate);
  }
}
