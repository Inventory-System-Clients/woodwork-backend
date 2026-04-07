import { randomUUID } from "node:crypto";
import { pool } from "../database/postgres";
import { Team, TeamCategory, TeamMember } from "../models/team.model";

interface TeamWithMemberRow {
  team_id: string;
  team_name: string;
  team_category: TeamCategory;
  team_description: string | null;
  team_created_at: string | Date;
  team_updated_at: string | Date;
  employee_id: string | null;
  employee_name: string | null;
  employee_position: string | null;
  employee_email: string | null;
  employee_phone: string | null;
  employee_is_active: boolean | null;
}

interface TeamRow {
  id: string;
  name: string;
  category: TeamCategory;
  description: string | null;
  created_at: string | Date;
  updated_at: string | Date;
}

export interface CreateTeamRecordInput {
  name: string;
  category: TeamCategory;
  description: string | null;
}

export interface SaveTeamInput {
  name: string;
  category: TeamCategory;
  description: string | null;
}

let teamCategoryColumnExists: boolean | null = null;

async function hasTeamCategoryColumn(): Promise<boolean> {
  if (teamCategoryColumnExists !== null) {
    return teamCategoryColumnExists;
  }

  const result = await pool.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'teams'
          AND column_name = 'category'
      ) AS exists;
    `,
  );

  teamCategoryColumnExists = Boolean(result.rows[0]?.exists);
  return teamCategoryColumnExists;
}

function toDateString(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

function mapTeamRow(row: TeamRow): Team {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description,
    createdAt: toDateString(row.created_at),
    updatedAt: toDateString(row.updated_at),
    members: [],
  };
}

function mapMemberRow(row: TeamWithMemberRow): TeamMember | null {
  if (!row.employee_id || !row.employee_name || row.employee_is_active === null) {
    return null;
  }

  return {
    employeeId: row.employee_id,
    name: row.employee_name,
    position: row.employee_position,
    email: row.employee_email,
    phone: row.employee_phone,
    isActive: row.employee_is_active,
  };
}

function groupTeamRows(rows: TeamWithMemberRow[]): Team[] {
  const teamsById = new Map<string, Team>();

  for (const row of rows) {
    const existingTeam = teamsById.get(row.team_id);

    if (!existingTeam) {
      teamsById.set(row.team_id, {
        id: row.team_id,
        name: row.team_name,
        category: row.team_category,
        description: row.team_description,
        createdAt: toDateString(row.team_created_at),
        updatedAt: toDateString(row.team_updated_at),
        members: [],
      });
    }

    const member = mapMemberRow(row);

    if (member) {
      teamsById.get(row.team_id)?.members.push(member);
    }
  }

  return [...teamsById.values()];
}

async function findAll(): Promise<Team[]> {
  const canUseCategory = await hasTeamCategoryColumn();
  const categorySelect = canUseCategory ? "t.category" : "'interna'::text";

  const result = await pool.query<TeamWithMemberRow>(
    `
      SELECT
        t.id AS team_id,
        t.name AS team_name,
        ${categorySelect} AS team_category,
        t.description AS team_description,
        t.created_at AS team_created_at,
        t.updated_at AS team_updated_at,
        e.id AS employee_id,
        e.name AS employee_name,
        e.position AS employee_position,
        e.email AS employee_email,
        e.phone AS employee_phone,
        e.is_active AS employee_is_active
      FROM public.teams t
      LEFT JOIN public.team_members tm
        ON tm.team_id = t.id
      LEFT JOIN public.employees e
        ON e.id = tm.employee_id
      ORDER BY t.created_at DESC, e.name ASC;
    `,
  );

  return groupTeamRows(result.rows);
}

async function findById(id: string): Promise<Team | undefined> {
  const canUseCategory = await hasTeamCategoryColumn();
  const categorySelect = canUseCategory ? "t.category" : "'interna'::text";

  const result = await pool.query<TeamWithMemberRow>(
    `
      SELECT
        t.id AS team_id,
        t.name AS team_name,
        ${categorySelect} AS team_category,
        t.description AS team_description,
        t.created_at AS team_created_at,
        t.updated_at AS team_updated_at,
        e.id AS employee_id,
        e.name AS employee_name,
        e.position AS employee_position,
        e.email AS employee_email,
        e.phone AS employee_phone,
        e.is_active AS employee_is_active
      FROM public.teams t
      LEFT JOIN public.team_members tm
        ON tm.team_id = t.id
      LEFT JOIN public.employees e
        ON e.id = tm.employee_id
      WHERE t.id = $1
      ORDER BY e.name ASC;
    `,
    [id],
  );

  if (result.rows.length === 0) {
    return undefined;
  }

  return groupTeamRows(result.rows)[0];
}

async function findByName(name: string): Promise<Team | undefined> {
  const canUseCategory = await hasTeamCategoryColumn();
  const categorySelect = canUseCategory ? "category" : "'interna'::text AS category";

  const result = await pool.query<TeamRow>(
    `
      SELECT
        id,
        name,
        ${categorySelect},
        description,
        created_at,
        updated_at
      FROM public.teams
      WHERE LOWER(name) = LOWER($1)
      LIMIT 1;
    `,
    [name],
  );

  return result.rows[0] ? mapTeamRow(result.rows[0]) : undefined;
}

async function create(payload: CreateTeamRecordInput): Promise<Team> {
  const canUseCategory = await hasTeamCategoryColumn();

  const result = canUseCategory
    ? await pool.query<TeamRow>(
        `
          INSERT INTO public.teams (
            id,
            name,
            category,
            description
          )
          VALUES ($1, $2, $3, $4)
          RETURNING
            id,
            name,
            category,
            description,
            created_at,
            updated_at;
        `,
        [randomUUID(), payload.name, payload.category, payload.description],
      )
    : await pool.query<TeamRow>(
        `
          INSERT INTO public.teams (
            id,
            name,
            description
          )
          VALUES ($1, $2, $3)
          RETURNING
            id,
            name,
            'interna'::text AS category,
            description,
            created_at,
            updated_at;
        `,
        [randomUUID(), payload.name, payload.description],
      );

  return mapTeamRow(result.rows[0]);
}

async function update(id: string, payload: SaveTeamInput): Promise<Team | undefined> {
  const canUseCategory = await hasTeamCategoryColumn();

  const result = canUseCategory
    ? await pool.query<TeamRow>(
        `
          UPDATE public.teams
          SET
            name = $2,
            category = $3,
            description = $4,
            updated_at = NOW()
          WHERE id = $1
          RETURNING
            id,
            name,
            category,
            description,
            created_at,
            updated_at;
        `,
        [id, payload.name, payload.category, payload.description],
      )
    : await pool.query<TeamRow>(
        `
          UPDATE public.teams
          SET
            name = $2,
            description = $3,
            updated_at = NOW()
          WHERE id = $1
          RETURNING
            id,
            name,
            'interna'::text AS category,
            description,
            created_at,
            updated_at;
        `,
        [id, payload.name, payload.description],
      );

  return result.rows[0] ? mapTeamRow(result.rows[0]) : undefined;
}

async function remove(id: string): Promise<boolean> {
  const result = await pool.query(
    `
      DELETE FROM public.teams
      WHERE id = $1;
    `,
    [id],
  );

  return result.rowCount === 1;
}

async function replaceMembers(teamId: string, employeeIds: string[]): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `
        DELETE FROM public.team_members
        WHERE team_id = $1;
      `,
      [teamId],
    );

    if (employeeIds.length > 0) {
      await client.query(
        `
          INSERT INTO public.team_members (team_id, employee_id)
          SELECT $1, employee_id
          FROM UNNEST($2::text[]) AS employee_id;
        `,
        [teamId, employeeIds],
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export const teamRepository = {
  findAll,
  findById,
  findByName,
  create,
  update,
  remove,
  replaceMembers,
};
