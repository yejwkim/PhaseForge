import { app, shell, BrowserWindow, ipcMain, session, globalShortcut } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

let mainWindow: BrowserWindow | null = null
let locked = false

// Dev convenience: lockdown (kiosk + shortcut blocking) is OFF in dev so we
// aren't trapped while building. Flip to true to test full lockdown in dev.
// Always ON in a packaged build.
const LOCKDOWN_IN_DEV = false

// Shortcuts swallowed while an exam is locked. (Cmd+Tab can't be blocked by an
// app on macOS — we detect it via window blur instead.)
const BLOCKED_SHORTCUTS = [
  'CommandOrControl+W',
  'CommandOrControl+R',
  'CommandOrControl+Shift+R',
  'CommandOrControl+M',
  'CommandOrControl+H',
  'CommandOrControl+Alt+I',
  'CommandOrControl+Shift+I',
  'F11',
  'F12'
]

function engageLockdown(): void {
  if (!mainWindow) return
  if (is.dev && !LOCKDOWN_IN_DEV) return // dev: skip kiosk + shortcut blocking
  locked = true
  mainWindow.setKiosk(true)
  const list = [...BLOCKED_SHORTCUTS, 'CommandOrControl+Q']
  for (const accel of list) globalShortcut.register(accel, () => {})
}

function disengageLockdown(): void {
  locked = false
  globalShortcut.unregisterAll()
  mainWindow?.setKiosk(false)
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 832,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })
  mainWindow = win

  win.on('ready-to-show', () => win.show())

  // Block closing the window while an exam is locked.
  win.on('close', (e) => {
    if (locked) e.preventDefault()
  })

  // Report focus changes to the renderer (focus-loss detection during exams).
  win.on('blur', () => win.webContents.send('lockdown:focus', false))
  win.on('focus', () => win.webContents.send('lockdown:focus', true))

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.phaseforge.desktop')

  // Allow camera (document camera for work capture); deny everything else.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === 'media')
  })
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => permission === 'media')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Renderer toggles lockdown when entering / leaving an exam.
  ipcMain.handle('lockdown:set', (_e, on: boolean) => {
    if (on) engageLockdown()
    else disengageLockdown()
    return locked
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
