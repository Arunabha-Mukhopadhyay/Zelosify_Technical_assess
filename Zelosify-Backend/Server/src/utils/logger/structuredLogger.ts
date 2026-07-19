export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => console.log(JSON.stringify({ timestamp: new Date().toISOString(), level: 'INFO', message, ...meta })),
  warn: (message: string, meta?: Record<string, unknown>) => console.warn(JSON.stringify({ timestamp: new Date().toISOString(), level: 'WARN', message, ...meta })),
  error: (message: string, meta?: Record<string, unknown>) => console.error(JSON.stringify({ timestamp: new Date().toISOString(), level: 'ERROR', message, ...meta })),
};
