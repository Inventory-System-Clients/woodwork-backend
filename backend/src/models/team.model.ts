import { z } from "zod";

const memberIdsSchema = z.array(z.string().trim().min(1, "employeeId is required")).max(200);
export const teamCategorySchema = z.enum(["interna", "terceirizada"]);

export type TeamCategory = z.infer<typeof teamCategorySchema>;

export interface TeamMember {
  employeeId: string;
  name: string;
  position: string | null;
  email: string | null;
  phone: string | null;
  isActive: boolean;
}

export interface Team {
  id: string;
  name: string;
  category: TeamCategory;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  members: TeamMember[];
}

export const createTeamSchema = z.object({
  name: z.string().trim().min(2, "name must have at least 2 characters").max(120),
  category: teamCategorySchema.default("interna"),
  description: z.string().trim().min(1).max(500).optional().nullable(),
  memberIds: memberIdsSchema.default([]),
});

export const updateTeamSchema = z
  .object({
    name: z.string().trim().min(2, "name must have at least 2 characters").max(120).optional(),
    category: teamCategorySchema.optional(),
    description: z.string().trim().min(1).max(500).optional().nullable(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "At least one field must be provided",
  });

export const setTeamMembersSchema = z.object({
  employeeIds: memberIdsSchema,
});

export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
export type SetTeamMembersInput = z.infer<typeof setTeamMembersSchema>;
