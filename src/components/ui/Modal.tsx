/**
 * @module Modal
 * Generic animated modal — backdrop + floating container, portalled to
 * `document.body`. Wrap any panel content inside.
 *
 * Backdrop click closes the modal. The close (×) button in the header is
 * rendered only when a `title` prop is provided; callers that want a custom
 * header should omit `title` and render their own within `children`.
 */

import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { DURATION, EASE } from '../../constants/animations'
import { useAnimations } from '../../hooks/useAnimations'

interface ModalProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  /** Optional title rendered in a bordered header bar. */
  title?: string
}

export function Modal({ open, onClose, children, title }: ModalProps) {
  const animationsEnabled = useAnimations()
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: animationsEnabled ? DURATION.base : 0 }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Container */}
          <motion.div
            className="relative z-10 bg-[#131f13] border border-white/10 rounded-2xl shadow-2xl w-full max-w-115 mx-4 overflow-hidden"
            initial={animationsEnabled ? { scale: 0.94, opacity: 0, y: 10 } : false}
            animate={{ scale: 1,    opacity: 1, y: 0 }}
            exit={animationsEnabled ? { scale: 0.97, opacity: 0, y: 4 } : { opacity: 0 }}
            transition={{ duration: animationsEnabled ? DURATION.base : 0, ease: EASE.modal }}
          >
            {title && (
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                <h2 className="text-white/90 text-[15px] font-semibold tracking-wide">
                  {title}
                </h2>
                <button
                  aria-label="Close"
                  onClick={onClose}
                  className="text-white/40 hover:text-white/80 transition-colors text-[22px] leading-none cursor-pointer border-0 bg-transparent"
                >
                  ×
                </button>
              </div>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
