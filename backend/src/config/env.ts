import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().trim().min(1, "DATABASE_URL is required"),
  PORT: z
    .string()
    .regex(/^\d+$/, "PORT must be a valid number")
    .transform(Number)
    .default("4000"),
});

export const env = envSchema.parse(process.env);