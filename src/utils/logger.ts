import winston from 'winston';
import 'winston-daily-rotate-file';
import path from 'path';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(
    (info) => `[${info.timestamp}] ${info.level.toUpperCase()}: ${info.message}`
  )
);

const transportDailyRotate = new winston.transports.DailyRotateFile({
  filename: 'rickclaw-%DATE%.log',
  dirname: path.resolve(process.cwd(), './data/logs/'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '90d', // Retém o log de 3 meses para auditoria
});

const promptTransport = new winston.transports.DailyRotateFile({
  filename: 'prompts-%DATE%.log',
  dirname: path.resolve(process.cwd(), './data/logs/'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '50m',
  maxFiles: '30d', // Prompt logs can be huge, keep for 1 month
});

export const logger = winston.createLogger({
  level: 'info',
  format: logFormat,
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    transportDailyRotate
  ],
});

export const promptLogger = winston.createLogger({
  level: 'info',
  format: logFormat,
  transports: [
    promptTransport
  ],
});
