import { z } from "zod";

export type UserRole = "admin" | "manager" | "operator";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export const createUserSchema = z.object({
  name: z.string().trim().min(2, "Name must have at least 2 characters").max(120),
  email: z.string().trim().email().toLowerCase(),
  role: z.enum(["admin", "manager", "operator"]).default("operator"),
});

export const updateUserSchema = createUserSchema
  .partial()
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "At least one field must be provided",
  });

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;