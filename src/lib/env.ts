import { z } from "zod";
import logger from "@/lib/logger";

const optionalString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().optional()
);

const optionalPort = z.preprocess(
  (value) => (value === "" || value === undefined ? undefined : value),
  z.coerce.number().int().min(1).max(65535).optional()
);

const optionalBoolean = z.preprocess(
  (value) => (value === "" || value === undefined ? undefined : value),
  z.enum(["true", "false"]).optional()
);

const emailProvider = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.enum(["smtp", "resend", "log"]).optional().default("smtp")
);

const envSchema = z.object({
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid URL"),
  NEXTAUTH_SECRET: z
    .string()
    .min(32, "NEXTAUTH_SECRET must be at least 32 characters")
    .refine((value) => !value.startsWith("generate-with:"), "NEXTAUTH_SECRET must be generated, not copied from the example"),
  NEXTAUTH_URL: z.string().url("NEXTAUTH_URL must be a valid URL").optional(),
  CLOUDINARY_CLOUD_NAME: z.string().min(1, "CLOUDINARY_CLOUD_NAME is required"),
  CLOUDINARY_API_KEY: z.string().min(1, "CLOUDINARY_API_KEY is required"),
  CLOUDINARY_API_SECRET: z.string().min(1, "CLOUDINARY_API_SECRET is required"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  EMAIL_PROVIDER: emailProvider,
  SMTP_HOST: optionalString,
  SMTP_PORT: optionalPort,
  SMTP_SECURE: optionalBoolean,
  SMTP_USER: optionalString,
  SMTP_PASSWORD: optionalString,
  EMAIL_FROM: optionalString,
  RESEND_API_KEY: optionalString,
  CRON_SECRET: optionalString,
  ALLOW_INSECURE_LOCALHOST: optionalBoolean,
}).superRefine((value, context) => {
  if (
    process.env.NODE_ENV === "production" &&
    value.NEXTAUTH_URL &&
    !value.NEXTAUTH_URL.startsWith("https://") &&
    !(value.ALLOW_INSECURE_LOCALHOST === "true" && /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(value.NEXTAUTH_URL))
  ) {
    context.addIssue({
      code: "custom",
      path: ["NEXTAUTH_URL"],
      message: "NEXTAUTH_URL must use HTTPS in production",
    });
  }
  if (process.env.NODE_ENV === "production" && !value.CRON_SECRET) {
    context.addIssue({
      code: "custom",
      path: ["CRON_SECRET"],
      message: "CRON_SECRET is required when scheduled jobs are enabled",
    });
  }
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    logger.error(
      { issues: result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
      "Invalid environment variables"
    );
    throw new Error("Invalid environment variables");
  }
  return result.data;
}
