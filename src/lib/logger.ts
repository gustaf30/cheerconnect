import pino from "pino";

const logger = pino({
  redact: {
    paths: [
      "password",
      "token",
      "auth",
      "email",
      "to",
      "*.password",
      "*.token",
      "*.auth",
      "*.email",
      "*.to",
    ],
    censor: "[REDACTED]",
  },
  ...(process.env.NODE_ENV === "development"
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }
    : {}),
});

export default logger;
