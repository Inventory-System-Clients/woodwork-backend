import { z } from "zod";

const optionalTextField = (maxLength: number) =>
  z.string().trim().min(1).max(maxLength).optional().nullable();

const emailSchema = z.string().trim().email("email must be valid").toLowerCase();
const passwordSchema = z
  .string()
  .min(6, "password must have at least 6 characters")
  .max(72, "password must have at most 72 characters");

export const employeeRoleSchema = z.enum(["admin", "funcionario", "gerente"]);
export type EmployeeRole = z.infer<typeof employeeRoleSchema>;

export interface Employee {
  id: string;
  name: string;
  position: string | null;
  phone: string | null;
  email: string;
  role: EmployeeRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const createEmployeeSchema = z.object({
  name: z.string().trim().min(2, "name must have at least 2 characters").max(120),
  position: optionalTextField(120),
  phone: optionalTextField(40),
  email: emailSchema,
  password: passwordSchema,
  role: employeeRoleSchema.default("funcionario"),
  isActive: z.coerce.boolean().default(true),
});

export const updateEmployeeSchema = z
  .object({
    name: z.string().trim().min(2, "name must have at least 2 characters").max(120).optional(),
    position: optionalTextField(120),
    phone: optionalTextField(40),
    email: emailSchema.optional(),
    password: passwordSchema.optional(),
    role: employeeRoleSchema.optional(),
    isActive: z.coerce.boolean().optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "At least one field must be provided",
  });

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
