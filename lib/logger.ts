export const logger = {
  debug: (...args: any[]) => {
    if (process.env.NODE_ENV === 'development') console.debug(...args)
  },
  info: (...args: any[]) => {
    if (process.env.NODE_ENV === 'development') console.info(...args)
  },
  warn: (...args: any[]) => console.warn(...args),
  error: (...args: any[]) => console.error(...args),
}

