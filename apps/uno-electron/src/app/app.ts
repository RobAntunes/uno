import { BrowserWindow, screen, app, WebContents } from 'electron';
import { rendererAppName, rendererAppPort } from './constants';
import { environment } from '../environments/environment';
import { join } from 'path';
import { format } from 'url';
import * as chokidar from 'chokidar';

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
    console.log(`[App Class] Initializing file watcher for path: ${watchPath}`);

    try {
      App.fileWatcher = chokidar.watch(watchPath, {
        ignored: /(^|[\/\\])\../,
        persistent: true,
        ignoreInitial: true,
        depth: 99,
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

    } catch (error) {
        console.error('[App Class] Failed to initialize file watcher:', error);
        App.fileWatcher = null;
    }
  }

  private static onWindowAllClosed() {
    if (process.platform !== 'darwin') {
      App.application.quit();
    }
  }

  private static onReady() {
    if (rendererAppName) {
      App.initMainWindow();
      App.loadMainWindow();
      App.initFileWatcher();
    }
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
    if (!App.application.isPackaged) {
      App.mainWindow?.loadURL(`http://localhost:${rendererAppPort}`);
    } else {
      App.mainWindow?.loadURL(
        format({
          pathname: join(__dirname, '..', rendererAppName, 'index.html'),
          protocol: 'file:',
          slashes: true,
        })
      );
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
