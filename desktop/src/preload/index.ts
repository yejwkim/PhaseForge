import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  lockdown: {
    engage: (): Promise<boolean> => ipcRenderer.invoke('lockdown:set', true),
    disengage: (): Promise<boolean> => ipcRenderer.invoke('lockdown:set', false),
    onFocusChange: (cb: (focused: boolean) => void): (() => void) => {
      const handler = (_e: IpcRendererEvent, focused: boolean): void => cb(focused)
      ipcRenderer.on('lockdown:focus', handler)
      return () => ipcRenderer.removeListener('lockdown:focus', handler)
    }
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
