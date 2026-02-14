/**
 * Accessibility Utilities
 *
 * Helper functions and constants for implementing WCAG 2.1 AA accessibility
 * features throughout the application.
 */

/**
 * Generate a unique ID for ARIA labeling
 *
 * @param prefix - Prefix for the ID (e.g., 'dialog', 'menu', 'tooltip')
 * @returns Unique ID string
 *
 * Usage:
 * const id = generateId('dialog')
 * <div id={id} role="dialog" aria-labelledby={`${id}-title`}>
 */
export function generateId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Handle keyboard click events (Enter and Space)
 *
 * Makes non-button elements keyboard accessible by responding to
 * Enter and Space keys like native buttons do.
 *
 * @param event - Keyboard event
 * @param callback - Function to execute on Enter/Space
 *
 * Usage:
 * <div
 *   role="button"
 *   tabIndex={0}
 *   onKeyDown={(e) => handleKeyboardClick(e, handleClick)}
 * >
 */
export function handleKeyboardClick(
  event: React.KeyboardEvent,
  callback: () => void
): void {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    callback()
  }
}

/**
 * Handle Escape key to close modals/dropdowns
 *
 * @param event - Keyboard event
 * @param callback - Function to execute on Escape
 *
 * Usage:
 * useEffect(() => {
 *   const handler = (e: KeyboardEvent) => handleEscapeKey(e, () => setOpen(false))
 *   document.addEventListener('keydown', handler)
 *   return () => document.removeEventListener('keydown', handler)
 * }, [])
 */
export function handleEscapeKey(
  event: KeyboardEvent | React.KeyboardEvent,
  callback: () => void
): void {
  if (event.key === 'Escape') {
    callback()
  }
}

/**
 * Standard ARIA labels for common UI elements
 *
 * Usage:
 * <button aria-label={ariaLabels.closeDialog}>X</button>
 */
export const ariaLabels = {
  // Dialog/Modal
  closeDialog: 'Close dialog',
  closeModal: 'Close modal',

  // Menu
  openMenu: 'Open menu',
  closeMenu: 'Close menu',
  userMenu: 'User menu',
  mainMenu: 'Main menu',

  // Navigation
  previousPage: 'Go to previous page',
  nextPage: 'Go to next page',
  firstPage: 'Go to first page',
  lastPage: 'Go to last page',

  // Search
  search: 'Search',
  clearSearch: 'Clear search',
  searchResults: 'Search results',

  // Forms
  required: 'Required field',
  optional: 'Optional field',
  showPassword: 'Show password',
  hidePassword: 'Hide password',

  // Actions
  edit: 'Edit',
  delete: 'Delete',
  save: 'Save',
  cancel: 'Cancel',
  submit: 'Submit',
  refresh: 'Refresh',
  filter: 'Filter',
  sort: 'Sort',

  // Status
  loading: 'Loading',
  error: 'Error',
  success: 'Success',
  warning: 'Warning',
} as const

/**
 * ARIA live region announcer for screen readers
 *
 * Announces dynamic content changes to screen reader users without
 * moving focus.
 *
 * @param message - Message to announce
 * @param priority - 'polite' (wait) or 'assertive' (interrupt)
 *
 * Usage:
 * announceToScreenReader('Task completed successfully')
 * announceToScreenReader('Error: Please try again', 'assertive')
 */
export function announceToScreenReader(
  message: string,
  priority: 'polite' | 'assertive' = 'polite'
): void {
  const announcement = document.createElement('div')
  announcement.setAttribute('role', 'status')
  announcement.setAttribute('aria-live', priority)
  announcement.setAttribute('aria-atomic', 'true')
  announcement.className = 'sr-only'
  announcement.textContent = message

  document.body.appendChild(announcement)

  // Remove after announcement
  setTimeout(() => {
    document.body.removeChild(announcement)
  }, 1000)
}

/**
 * Focus trap for modals/dialogs
 *
 * Keeps focus within a container (modal) when Tab key is pressed.
 * Essential for keyboard accessibility in modal dialogs.
 *
 * @param containerRef - Reference to container element
 *
 * Usage:
 * const dialogRef = useRef<HTMLDivElement>(null)
 * useEffect(() => {
 *   return createFocusTrap(dialogRef)
 * }, [])
 */
export function createFocusTrap(
  containerRef: React.RefObject<HTMLElement>
): () => void {
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Tab' || !containerRef.current) return

    const focusableElements = containerRef.current.querySelectorAll(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )

    const firstElement = focusableElements[0] as HTMLElement
    const lastElement = focusableElements[
      focusableElements.length - 1
    ] as HTMLElement

    if (event.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstElement) {
        event.preventDefault()
        lastElement?.focus()
      }
    } else {
      // Tab
      if (document.activeElement === lastElement) {
        event.preventDefault()
        firstElement?.focus()
      }
    }
  }

  document.addEventListener('keydown', handleKeyDown)

  return () => {
    document.removeEventListener('keydown', handleKeyDown)
  }
}

/**
 * Check if an element is visible (for accessibility testing)
 *
 * @param element - Element to check
 * @returns Boolean indicating if element is visible
 */
export function isVisible(element: HTMLElement): boolean {
  return !!(
    element.offsetWidth ||
    element.offsetHeight ||
    element.getClientRects().length
  )
}

/**
 * Get all focusable elements within a container
 *
 * @param container - Container element
 * @returns Array of focusable elements
 *
 * Usage:
 * const focusable = getFocusableElements(dialogRef.current)
 * focusable[0]?.focus() // Focus first element
 */
export function getFocusableElements(
  container: HTMLElement
): HTMLElement[] {
  if (!container) return []

  const elements = container.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )

  return Array.from(elements).filter(isVisible)
}
