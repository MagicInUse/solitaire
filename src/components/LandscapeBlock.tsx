import styles from './LandscapeBlock.module.css'

/** Covers the screen in landscape orientation and prompts the user to rotate. */
export function LandscapeBlock() {
  return (
    <div className={styles.overlay} aria-live="polite" role="alert">
      <div className={styles.inner}>
        <div className={styles.phoneIcon} />
        <p className={styles.label}>Rotate your device to play</p>
      </div>
    </div>
  )
}
