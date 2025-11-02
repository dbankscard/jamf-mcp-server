import winston from 'winston';
import path from 'path';

const logLevel = process.env.LOG_LEVEL || 'info';
const nodeEnv = process.env.NODE_ENV || 'development';

// Custom format for structured logging
const structuredFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.metadata({
    fillExcept: ['message', 'level', 'timestamp', 'label']
  }),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, label, ...metadata }) => {
    let msg = `${timestamp} [${label}] ${level}: ${message}`;
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
  })
);

// Create logger factory
export const createLogger = (label: string): winston.Logger => {
  const transports: winston.transport[] = [];

  // Console transport - disabled for MCP mode to avoid stdout/stderr pollution
  const isMCPMode = process.env.MCP_MODE === 'true' || process.argv.includes('--mcp');
  if (nodeEnv !== 'test' && !isMCPMode) {
    transports.push(
      new winston.transports.Console({
        format: nodeEnv === 'development' ? consoleFormat : structuredFormat,
      })
    );
  }

  // File transport for production
  if (nodeEnv === 'production') {
    const logDir = process.env.LOG_DIR || '/var/log/jamf-mcp-server';
    
    transports.push(
      new winston.transports.File({
        filename: path.join(logDir, 'error.log'),
        level: 'error',
        format: structuredFormat,
        maxsize: 10485760, // 10MB
        maxFiles: 5,
      })
    );

    transports.push(
      new winston.transports.File({
        filename: path.join(logDir, 'combined.log'),
        format: structuredFormat,
        maxsize: 10485760, // 10MB
        maxFiles: 10,
      })
    );
  }

  return winston.createLogger({
    level: logLevel,
    format: winston.format.combine(
      winston.format.label({ label }),
      winston.format.timestamp(),
      winston.format.errors({ stack: true })
    ),
    transports,
    // Don't exit on uncaught errors
    exitOnError: false,
  });
};

// Default logger for general use
export const logger = createLogger('jamf-mcp-server');

// Log unhandled rejections and exceptions
if (nodeEnv !== 'test') {
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', { promise, reason });
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    // Give the logger time to write before exiting
    setTimeout(() => process.exit(1), 1000);
  });
}