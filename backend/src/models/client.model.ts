import { z } from "zod";

const optionalTextField = (maxLength: number) =>
  z.string().trim().min(1).max(maxLength).optional().nullable();

const emailSchema = z.string().trim().email("email must be valid").toLowerCase();

const listClientsQueryIsActiveSchema = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

export interface Client {
  id: string;
  name: string;
  companyName: string | null;
  document: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  secondaryPhone: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  notes: string | null;
  isActive: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export const createClientSchema = z.object({
  name: z.string().trim().min(2, "name must have at least 2 characters").max(200),
  companyName: optionalTextField(200),
  document: optionalTextField(30),
  contactName: optionalTextField(200),
  email: emailSchema.optional().nullable(),
  phone: optionalTextField(40),
  secondaryPhone: optionalTextField(40),
  street: optionalTextField(200),
  number: optionalTextField(50),
  complement: optionalTextField(120),
  neighborhood: optionalTextField(120),
  city: optionalTextField(120),
  state: optionalTextField(60),
  postalCode: optionalTextField(20),
  notes: optionalTextField(2000),
  isActive: z.coerce.boolean().default(true),
  metadata: z.record(z.unknown()).optional().nullable(),
});

export const updateClientSchema = z
  .object({
    name: z.string().trim().min(2, "name must have at least 2 characters").max(200).optional(),
    companyName: optionalTextField(200),
    document: optionalTextField(30),
    contactName: optionalTextField(200),
    email: emailSchema.optional().nullable(),
    phone: optionalTextField(40),
    secondaryPhone: optionalTextField(40),
    street: optionalTextField(200),
    number: optionalTextField(50),
    complement: optionalTextField(120),
    neighborhood: optionalTextField(120),
    city: optionalTextField(120),
    state: optionalTextField(60),
    postalCode: optionalTextField(20),
    notes: optionalTextField(2000),
    isActive: z.coerce.boolean().optional(),
    metadata: z.record(z.unknown()).optional().nullable(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "At least one field must be provided",
  });

export const listClientsQuerySchema = z.object({
  search: z.string().trim().min(1).max(200).optional(),
  isActive: listClientsQueryIsActiveSchema.optional(),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type ListClientsQueryInput = z.infer<typeof listClientsQuerySchema>;
