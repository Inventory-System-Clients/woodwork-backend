import { z } from "zod";

const optionalTextField = (maxLength: number) =>
  z.string().trim().min(1).max(maxLength).optional().nullable();

export interface Employee {
  id: string;
  name: string;
  position: string | null;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const createEmployeeSchema = z.object({
  name: z.string().trim().min(2, "name must have at least 2 characters").max(120),
  position: optionalTextField(120),
  phone: optionalTextField(40),
  email: z.string().trim().email("email must be valid").toLowerCase().optional().nullable(),
  isActive: z.coerce.boolean().default(true),
});

export const updateEmployeeSchema = createEmployeeSchema
  .partial()
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "At least one field must be provided",
  });

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
