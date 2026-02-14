import { cn } from "@/lib/utils"

/**
 * Base Skeleton component
 * Creates animated placeholder for loading states
 *
 * Usage:
 * <Skeleton className="h-4 w-full" />
 */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-gray-200", className)}
      {...props}
    />
  )
}

/**
 * Table Skeleton
 * Displays loading state for table/list views
 *
 * @param rows - Number of skeleton rows to display (default: 5)
 *
 * Usage:
 * {loading ? <TableSkeleton rows={10} /> : <DataTable />}
 */
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          {/* Avatar/Icon skeleton */}
          <Skeleton className="h-12 w-12 rounded-full flex-shrink-0" />

          {/* Content skeleton */}
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>

          {/* Action skeleton */}
          <Skeleton className="h-8 w-20 flex-shrink-0" />
        </div>
      ))}
    </div>
  )
}

/**
 * Card Skeleton
 * Displays loading state for card components
 *
 * Usage:
 * {loading ? <CardSkeleton /> : <Card>...</Card>}
 */
export function CardSkeleton() {
  return (
    <div className="p-6 space-y-4">
      {/* Header skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
      </div>

      {/* Content skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>

      {/* Footer/Actions skeleton */}
      <div className="flex gap-2 pt-4">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
      </div>
    </div>
  )
}

/**
 * Stats Card Skeleton
 * Displays loading state for statistics cards
 *
 * Usage:
 * {loading ? <StatsCardSkeleton /> : <StatsCard />}
 */
export function StatsCardSkeleton() {
  return (
    <div className="p-6 space-y-3">
      <Skeleton className="h-4 w-1/2" />
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
    </div>
  )
}

/**
 * Form Skeleton
 * Displays loading state for forms
 *
 * @param fields - Number of form fields to display (default: 3)
 *
 * Usage:
 * {loading ? <FormSkeleton fields={5} /> : <Form />}
 */
export function FormSkeleton({ fields = 3 }: { fields?: number }) {
  return (
    <div className="space-y-6 p-6">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          {/* Label skeleton */}
          <Skeleton className="h-4 w-24" />
          {/* Input skeleton */}
          <Skeleton className="h-10 w-full" />
        </div>
      ))}

      {/* Submit button skeleton */}
      <div className="pt-4">
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  )
}

/**
 * Page Header Skeleton
 * Displays loading state for page headers with title and actions
 *
 * Usage:
 * {loading ? <PageHeaderSkeleton /> : <PageHeader />}
 */
export function PageHeaderSkeleton() {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      {/* Title section */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  )
}

/**
 * Grid Skeleton
 * Displays loading state for grid layouts
 *
 * @param items - Number of grid items (default: 6)
 * @param cols - Number of columns (default: 3)
 *
 * Usage:
 * {loading ? <GridSkeleton items={9} cols={3} /> : <Grid />}
 */
export function GridSkeleton({
  items = 6,
  cols = 3
}: {
  items?: number
  cols?: number
}) {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  }[cols] || 'grid-cols-3'

  return (
    <div className={cn('grid gap-4', gridCols)}>
      {Array.from({ length: items }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  )
}

/**
 * Avatar Skeleton
 * Displays loading state for user avatars
 *
 * @param size - Size variant (sm, md, lg)
 *
 * Usage:
 * {loading ? <AvatarSkeleton size="lg" /> : <Avatar />}
 */
export function AvatarSkeleton({
  size = 'md'
}: {
  size?: 'sm' | 'md' | 'lg'
}) {
  const sizes = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12',
  }

  return <Skeleton className={cn(sizes[size], 'rounded-full')} />
}

/**
 * Text Skeleton
 * Displays loading state for text content
 *
 * @param lines - Number of text lines (default: 3)
 *
 * Usage:
 * {loading ? <TextSkeleton lines={5} /> : <p>{content}</p>}
 */
export function TextSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            'h-4',
            i === lines - 1 ? 'w-3/4' : 'w-full'
          )}
        />
      ))}
    </div>
  )
}
