/**
 * Skip Link Component
 *
 * Provides keyboard users with a way to skip repetitive navigation
 * and jump directly to main content. Required for WCAG 2.1 AA compliance.
 *
 * The link is visually hidden by default but becomes visible when focused
 * via keyboard navigation (Tab key).
 *
 * Usage:
 * Add <SkipLink /> at the very top of your layout, before any other content.
 * Ensure main content has id="main-content"
 */
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[999] focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-md focus:shadow-lg transition-all"
    >
      Skip to main content
    </a>
  )
}
