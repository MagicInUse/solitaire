import { useState, useEffect } from 'react'
import { CANVAS_W, CANVAS_H } from '../constants/canvas'

export function useGameScale(): number {
  const [scale, setScale] = useState(() =>
    Math.min(window.innerWidth / CANVAS_W, window.innerHeight / CANVAS_H)
  )

  useEffect(() => {
    const update = () =>
      setScale(Math.min(window.innerWidth / CANVAS_W, window.innerHeight / CANVAS_H))

    // ResizeObserver on <html> is more reliable than window.resize on mobile
    const ro = new ResizeObserver(update)
    ro.observe(document.documentElement)
    return () => ro.disconnect()
  }, [])

  return scale
}
