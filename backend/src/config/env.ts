import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z
    .string({ required_error: "DATABASE_URL is required" })
    .trim()
    .min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().trim().min(16).default("change-me-in-production"),
  JWT_EXPIRES_IN: z.string().trim().min(1).default("12h"),
  FRONTEND_PUBLIC_BASE_URL: z.string().trim().default(""),
  PORT: z
    .string()
    .regex(/^\d+$/, "PORT must be a valid number")
    .transform(Number)
    .default("4000"),
});

export const env = envSchema.parse(process.env);