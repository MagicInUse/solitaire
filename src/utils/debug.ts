/** True when the page URL requests the debug overlay (`?debug=1`). */
export function isDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('debug') === '1'
}
