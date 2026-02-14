/**
 * Design Tokens - MOSiR Portal
 *
 * Centralized design system tokens for consistent spacing, typography, and colors.
 * These tokens should be used instead of hard-coded Tailwind classes throughout the app.
 *
 * Usage:
 * import { spacing, gaps, typography } from '@/lib/design-tokens'
 * <div className={cn(spacing.lg, gaps.md)}>...</div>
 */

/**
 * Spacing scale for padding
 * Use these instead of hard-coded p-* values
 */
export const spacing = {
  xs: 'p-2',    // 8px
  sm: 'p-3',    // 12px
  md: 'p-4',    // 16px
  lg: 'p-6',    // 24px
  xl: 'p-8',    // 32px
  '2xl': 'p-12', // 48px
} as const

/**
 * Responsive padding variations
 */
export const responsiveSpacing = {
  page: 'px-4 sm:px-6 py-4 sm:py-6',           // Standard page padding
  card: 'p-4 sm:p-6',                           // Card content padding
  cardHeader: 'p-4 sm:p-6 pb-3',                // Card header padding
  cardCompact: 'p-3 sm:p-4',                    // Compact card padding
  section: 'py-6 sm:py-8',                      // Section spacing
} as const

/**
 * Gap scale for flex/grid layouts
 * Use these instead of hard-coded gap-* values
 */
export const gaps = {
  xs: 'gap-2',  // 8px
  sm: 'gap-3',  // 12px
  md: 'gap-4',  // 16px
  lg: 'gap-6',  // 24px
  xl: 'gap-8',  // 32px
} as const

/**
 * Typography scale with responsive variants
 * Use these instead of hard-coded text-* values
 */
export const typography = {
  // Headers
  h1: 'text-2xl sm:text-3xl font-bold text-gray-900',
  h2: 'text-xl sm:text-2xl font-semibold text-gray-900',
  h3: 'text-lg sm:text-xl font-semibold text-gray-900',
  h4: 'text-base sm:text-lg font-medium text-gray-900',

  // Body text
  body: 'text-sm sm:text-base text-gray-700',
  bodyLarge: 'text-base sm:text-lg text-gray-700',
  small: 'text-xs sm:text-sm text-gray-600',

  // Labels
  label: 'text-sm font-medium text-gray-700',
  labelSmall: 'text-xs font-medium text-gray-600',

  // Muted text
  muted: 'text-sm text-gray-500',
  mutedSmall: 'text-xs text-gray-500',

  // Helpers
  helper: 'text-xs text-gray-500',
  error: 'text-xs text-red-600',
  success: 'text-xs text-green-600',
} as const

/**
 * Status colors for badges and alerts
 * Consistent color scheme across the application
 */
export const statusColors = {
  // Success states (green)
  success: {
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-200',
    full: 'bg-green-50 text-green-700 border-green-200',
  },

  // Warning states (yellow/orange)
  warning: {
    bg: 'bg-yellow-50',
    text: 'text-yellow-700',
    border: 'border-yellow-200',
    full: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  },

  // Error/Danger states (red)
  error: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    full: 'bg-red-50 text-red-700 border-red-200',
  },

  // Info states (blue)
  info: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    full: 'bg-blue-50 text-blue-700 border-blue-200',
  },

  // Neutral/Muted states (gray)
  neutral: {
    bg: 'bg-gray-50',
    text: 'text-gray-700',
    border: 'border-gray-200',
    full: 'bg-gray-50 text-gray-700 border-gray-200',
  },

  // Purple (for special states)
  purple: {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    full: 'bg-purple-50 text-purple-700 border-purple-200',
  },

  // Orange (for early leave, warnings)
  orange: {
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    border: 'border-orange-200',
    full: 'bg-orange-50 text-orange-700 border-orange-200',
  },

  // Cyan (for special shifts)
  cyan: {
    bg: 'bg-cyan-50',
    text: 'text-cyan-700',
    border: 'border-cyan-200',
    full: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  },
} as const

/**
 * Task/Attendance status color mapping
 * Maps status strings to color classes
 */
export const taskStatusColors = {
  completed: statusColors.success.full,
  in_progress: statusColors.warning.full,
  pending: statusColors.info.full,
  new: statusColors.info.full,
  cancelled: statusColors.neutral.full,
} as const

/**
 * Priority color mapping
 */
export const priorityColors = {
  high: statusColors.error.full,
  medium: statusColors.warning.full,
  low: statusColors.success.full,
} as const

/**
 * Attendance status colors
 */
export const attendanceStatusColors = {
  present: statusColors.success.full,
  absent: statusColors.error.full,
  late: statusColors.warning.full,
  earlyLeave: statusColors.orange.full,
} as const

/**
 * Border radius scale
 */
export const radius = {
  none: 'rounded-none',
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  '2xl': 'rounded-2xl',
  full: 'rounded-full',
} as const

/**
 * Shadow scale
 */
export const shadows = {
  sm: 'shadow-sm',
  md: 'shadow-md',
  lg: 'shadow-lg',
  xl: 'shadow-xl',
  '2xl': 'shadow-2xl',
  none: 'shadow-none',
} as const

/**
 * Transition utilities
 */
export const transitions = {
  default: 'transition-all duration-200',
  fast: 'transition-all duration-150',
  slow: 'transition-all duration-300',
  colors: 'transition-colors duration-200',
} as const

/**
 * Focus ring for accessibility
 */
export const focusRing = 'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'

/**
 * Common button styles (complement shadcn button variants)
 */
export const buttonStyles = {
  iconOnly: 'p-2 h-auto w-auto',
  withIcon: 'inline-flex items-center gap-2',
} as const

/**
 * Grid patterns
 */
export const grids = {
  stats: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6',
  cards: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6',
  form: 'grid grid-cols-1 md:grid-cols-2 gap-4',
} as const

/**
 * Container max widths
 */
export const containers = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  full: 'max-w-full',
} as const
