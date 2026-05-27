import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// iOS PWA: when the app resumes from background suspension, iOS can present a
// stale GPU layer that appears as a blank/grey screen. Nudging the root
// element's transform forces a composite layer re-commit and triggers a repaint.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    requestAnimationFrame(() => {
      const root = document.getElementById('root')
      if (root) {
        root.style.transform = 'translateZ(0)'
        requestAnimationFrame(() => { root.style.transform = '' })
      }
    })
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
