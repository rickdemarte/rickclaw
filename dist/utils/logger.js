"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.promptLogger = exports.logger = void 0;
const winston_1 = __importDefault(require("winston"));
require("winston-daily-rotate-file");
const path_1 = __importDefault(require("path"));
const logFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston_1.default.format.printf((info) => `[${info.timestamp}] ${info.level.toUpperCase()}: ${info.message}`));
const transportDailyRotate = new winston_1.default.transports.DailyRotateFile({
    filename: 'rickclaw-%DATE%.log',
    dirname: path_1.default.resolve(process.cwd(), './data/logs/'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '90d', // Retém o log de 3 meses para auditoria
});
const promptTransport = new winston_1.default.transports.DailyRotateFile({
    filename: 'prompts-%DATE%.log',
    dirname: path_1.default.resolve(process.cwd(), './data/logs/'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '50m',
    maxFiles: '30d', // Prompt logs can be huge, keep for 1 month
});
exports.logger = winston_1.default.createLogger({
    level: 'info',
    format: logFormat,
    transports: [
        new winston_1.default.transports.Console({
            format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.simple())
        }),
        transportDailyRotate
    ],
});
exports.promptLogger = winston_1.default.createLogger({
    level: 'info',
    format: logFormat,
    transports: [
        promptTransport
    ],
});
//# sourceMappingURL=logger.js.map