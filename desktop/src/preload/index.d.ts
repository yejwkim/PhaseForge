import { ElectronAPI } from '@electron-toolkit/preload'

export interface LockdownApi {
  engage: () => Promise<boolean>
  disengage: () => Promise<boolean>
  onFocusChange: (cb: (focused: boolean) => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: { lockdown: LockdownApi }
  }
}
