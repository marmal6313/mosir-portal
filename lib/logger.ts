export const logger = {
  debug: (...args: unknown[]) => {
    if (process.env.NODE_ENV === 'development') console.debug(...args)
  },
  info: (...args: unknown[]) => {
    if (process.env.NODE_ENV === 'development') console.info(...args)
  },
  warn: (...args: unknown[]) => console.warn(...args),
  error: (...args: unknown[]) => console.error(...args),
}
