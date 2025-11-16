/**
 * Logging utilities for the sync service
 */

export type LogLevel = "INFO" | "WARN" | "ERROR" | "DEBUG";

interface LogContext {
  [key: string]: unknown;
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

function log(level: LogLevel, message: string, context?: LogContext): void {
  const timestamp = formatTimestamp();
  const contextStr = context ? `\n  Context: ${JSON.stringify(context, null, 2)}` : "";
  console.log(`[${level}] [${timestamp}] ${message}${contextStr}`);
}

export function info(message: string, context?: LogContext): void {
  log("INFO", message, context);
}

export function warn(message: string, context?: LogContext): void {
  log("WARN", message, context);
}

export function error(message: string, context?: LogContext): void {
  log("ERROR", message, context);
}

export function debug(message: string, context?: LogContext): void {
  log("DEBUG", message, context);
}
