type LogLevel = "debug" | "info" | "warn" | "error";

function writeLog(level: LogLevel, message: string, ...args: unknown[]): void {
  const prefix = `[${new Date().toISOString()}] [${level.toUpperCase()}]`;

  if (level === "error") {
    console.error(prefix, message, ...args);
  } else if (level === "warn") {
    console.warn(prefix, message, ...args);
  } else {
    console.log(prefix, message, ...args);
  }
}

export const logger = {
  debug: (message: string, ...args: unknown[]): void => {
    writeLog("debug", message, ...args);
  },
  info: (message: string, ...args: unknown[]): void => {
    writeLog("info", message, ...args);
  },
  warn: (message: string, ...args: unknown[]): void => {
    writeLog("warn", message, ...args);
  },
  error: (message: string, ...args: unknown[]): void => {
    writeLog("error", message, ...args);
  },
};
