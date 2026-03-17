import { randomUUID } from "node:crypto";
import { pool } from "../database/postgres";
import { CreateEmployeeInput, Employee, EmployeeRole } from "../models/employee.model";

interface EmployeeRow {
  id: string;
  name: string;
  position: string | null;
  phone: string | null;
  email: string;
  role: EmployeeRole;
  is_active: boolean;
  created_at: string | Date;
  updated_at: string | Date;
}

interface EmployeeAuthRow extends EmployeeRow {
  password_hash: string | null;
}

export interface AuthEmployee {
  id: string;
  name: string;
  email: string;
  role: EmployeeRole;
  isActive: boolean;
  passwordHash: string | null;
}

export interface SaveEmployeeInput {
  name: string;
  position: string | null;
  phone: string | null;
  email: string;
  role: EmployeeRole;
  isActive: boolean;
  passwordHash: string | null;
}

function toDateString(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

function mapEmployeeRow(row: EmployeeRow): Employee {
  return {
    id: row.id,
    name: row.name,
    position: row.position,
    phone: row.phone,
    email: row.email,
    role: row.role,
    isActive: row.is_active,
    createdAt: toDateString(row.created_at),
    updatedAt: toDateString(row.updated_at),
  };
}

function mapAuthEmployeeRow(row: EmployeeAuthRow): AuthEmployee {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    isActive: row.is_active,
    passwordHash: row.password_hash,
  };
}

async function findAll(): Promise<Employee[]> {
  const result = await pool.query<EmployeeRow>(
    `
      SELECT
        id,
        name,
        position,
        phone,
        email,
        role,
        is_active,
        created_at,
        updated_at
      FROM public.employees
      ORDER BY created_at DESC;
    `,
  );

  return result.rows.map(mapEmployeeRow);
}

async function findById(id: string): Promise<Employee | undefined> {
  const result = await pool.query<EmployeeRow>(
    `
      SELECT
        id,
        name,
        position,
        phone,
        email,
        role,
        is_active,
        created_at,
        updated_at
      FROM public.employees
      WHERE id = $1;
    `,
    [id],
  );

  return result.rows[0] ? mapEmployeeRow(result.rows[0]) : undefined;
}

async function findByEmail(email: string): Promise<Employee | undefined> {
  const result = await pool.query<EmployeeRow>(
    `
      SELECT
        id,
        name,
        position,
        phone,
        email,
        role,
        is_active,
        created_at,
        updated_at
      FROM public.employees
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1;
    `,
    [email],
  );

  return result.rows[0] ? mapEmployeeRow(result.rows[0]) : undefined;
}

async function findByIds(ids: string[]): Promise<Employee[]> {
  if (ids.length === 0) {
    return [];
  }

  const result = await pool.query<EmployeeRow>(
    `
      SELECT
        id,
        name,
        position,
        phone,
        email,
        role,
        is_active,
        created_at,
        updated_at
      FROM public.employees
      WHERE id = ANY($1::text[]);
    `,
    [ids],
  );

  return result.rows.map(mapEmployeeRow);
}

async function findAuthById(id: string): Promise<AuthEmployee | undefined> {
  const result = await pool.query<EmployeeAuthRow>(
    `
      SELECT
        id,
        name,
        position,
        phone,
        email,
        role,
        is_active,
        created_at,
        updated_at,
        password_hash
      FROM public.employees
      WHERE id = $1;
    `,
    [id],
  );

  return result.rows[0] ? mapAuthEmployeeRow(result.rows[0]) : undefined;
}

async function findAuthByEmail(email: string): Promise<AuthEmployee | undefined> {
  const result = await pool.query<EmployeeAuthRow>(
    `
      SELECT
        id,
        name,
        position,
        phone,
        email,
        role,
        is_active,
        created_at,
        updated_at,
        password_hash
      FROM public.employees
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1;
    `,
    [email],
  );

  return result.rows[0] ? mapAuthEmployeeRow(result.rows[0]) : undefined;
}

async function create(payload: CreateEmployeeInput, passwordHash: string): Promise<Employee> {
  const result = await pool.query<EmployeeRow>(
    `
      INSERT INTO public.employees (
        id,
        name,
        position,
        phone,
        email,
        role,
        password_hash,
        is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING
        id,
        name,
        position,
        phone,
        email,
        role,
        is_active,
        created_at,
        updated_at;
    `,
    [
      randomUUID(),
      payload.name,
      payload.position ?? null,
      payload.phone ?? null,
      payload.email,
      payload.role,
      passwordHash,
      payload.isActive,
    ],
  );

  return mapEmployeeRow(result.rows[0]);
}

async function update(id: string, payload: SaveEmployeeInput): Promise<Employee | undefined> {
  const result = await pool.query<EmployeeRow>(
    `
      UPDATE public.employees
      SET
        name = $2,
        position = $3,
        phone = $4,
        email = $5,
        role = $6,
        is_active = $7,
        password_hash = $8,
        updated_at = NOW()
      WHERE id = $1
      RETURNING
        id,
        name,
        position,
        phone,
        email,
        role,
        is_active,
        created_at,
        updated_at;
    `,
    [
      id,
      payload.name,
      payload.position,
      payload.phone,
      payload.email,
      payload.role,
      payload.isActive,
      payload.passwordHash,
    ],
  );

  return result.rows[0] ? mapEmployeeRow(result.rows[0]) : undefined;
}

async function remove(id: string): Promise<boolean> {
  const result = await pool.query(
    `
      DELETE FROM public.employees
      WHERE id = $1;
    `,
    [id],
  );

  return result.rowCount === 1;
}

export const employeeRepository = {
  findAll,
  findById,
  findByEmail,
  findByIds,
  findAuthById,
  findAuthByEmail,
  create,
  update,
  remove,
};
