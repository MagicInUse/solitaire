/**
 * @module useInstallPrompt
 *
 * Intercepts the browser's `beforeinstallprompt` event so we can surface a
 * native install affordance inside the Options panel rather than relying on
 * the hard-to-find address-bar install button.
 *
 * Only relevant on Chromium-based browsers (Chrome, Edge, Samsung Internet)
 * on Android and desktop. iOS handles installs via Safari's Share sheet — no
 * programmatic prompt is available there. `canInstall` stays false on iOS,
 * so the UI simply doesn't render.
 */

import { useEffect, useState } from 'react'

/** Minimal typing for the non-standard BeforeInstallPromptEvent. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface InstallPrompt {
  /** True when a deferred install prompt is available to trigger. */
  canInstall: boolean
  /** Trigger the native install dialog. No-op if no prompt is available. */
  install: () => Promise<void>
}

export function useInstallPrompt(): InstallPrompt {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => setDeferred(null)

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const install = async () => {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice
    setDeferred(null)
  }

  return { canInstall: deferred !== null, install }
}
