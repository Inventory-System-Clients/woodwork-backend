import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email("email must be valid").toLowerCase(),
  password: z.string().min(1, "password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;
