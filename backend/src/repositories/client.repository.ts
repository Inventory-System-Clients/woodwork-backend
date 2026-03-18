import { randomUUID } from "node:crypto";
import { pool } from "../database/postgres";
import { Client, CreateClientInput } from "../models/client.model";
import { AppError } from "../utils/app-error";

interface ClientRow {
  id: string;
  name: string;
  company_name: string | null;
  document: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  secondary_phone: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  notes: string | null;
  is_active: boolean;
  metadata: unknown;
  created_at: string | Date;
  updated_at: string | Date;
}

export interface SaveClientInput {
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
}

function toDateString(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

function toMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function mapClientRow(row: ClientRow): Client {
  return {
    id: row.id,
    name: row.name,
    companyName: row.company_name,
    document: row.document,
    contactName: row.contact_name,
    email: row.email,
    phone: row.phone,
    secondaryPhone: row.secondary_phone,
    street: row.street,
    number: row.number,
    complement: row.complement,
    neighborhood: row.neighborhood,
    city: row.city,
    state: row.state,
    postalCode: row.postal_code,
    notes: row.notes,
    isActive: row.is_active,
    metadata: toMetadata(row.metadata),
    createdAt: toDateString(row.created_at),
    updatedAt: toDateString(row.updated_at),
  };
}

function normalizeSchemaError(error: unknown): never {
  const code = (error as { code?: string }).code;

  if (code === "42P01" || code === "42703") {
    throw new AppError("Clients schema is not configured. Run sql/20260318_create_clients.sql", 500);
  }

  throw error;
}

async function findAll(search?: string, isActive?: boolean): Promise<Client[]> {
  try {
    const result = await pool.query<ClientRow>(
      `
        SELECT
          id::text AS id,
          name,
          company_name,
          document,
          contact_name,
          email,
          phone,
          secondary_phone,
          street,
          number,
          complement,
          neighborhood,
          city,
          state,
          postal_code,
          notes,
          is_active,
          metadata,
          created_at,
          updated_at
        FROM public.clients
        WHERE ($1::text IS NULL OR (
          LOWER(name) LIKE CONCAT('%', LOWER(BTRIM($1)), '%')
          OR LOWER(COALESCE(company_name, '')) LIKE CONCAT('%', LOWER(BTRIM($1)), '%')
          OR LOWER(COALESCE(document, '')) LIKE CONCAT('%', LOWER(BTRIM($1)), '%')
          OR LOWER(COALESCE(email, '')) LIKE CONCAT('%', LOWER(BTRIM($1)), '%')
          OR LOWER(COALESCE(phone, '')) LIKE CONCAT('%', LOWER(BTRIM($1)), '%')
        ))
          AND ($2::boolean IS NULL OR is_active = $2)
        ORDER BY is_active DESC, LOWER(name) ASC, created_at DESC;
      `,
      [search ?? null, isActive ?? null],
    );

    return result.rows.map(mapClientRow);
  } catch (error) {
    normalizeSchemaError(error);
  }
}

async function findById(id: string): Promise<Client | undefined> {
  try {
    const result = await pool.query<ClientRow>(
      `
        SELECT
          id::text AS id,
          name,
          company_name,
          document,
          contact_name,
          email,
          phone,
          secondary_phone,
          street,
          number,
          complement,
          neighborhood,
          city,
          state,
          postal_code,
          notes,
          is_active,
          metadata,
          created_at,
          updated_at
        FROM public.clients
        WHERE id::text = $1;
      `,
      [id],
    );

    return result.rows[0] ? mapClientRow(result.rows[0]) : undefined;
  } catch (error) {
    normalizeSchemaError(error);
  }
}

async function findByEmail(email: string): Promise<Client | undefined> {
  try {
    const result = await pool.query<ClientRow>(
      `
        SELECT
          id::text AS id,
          name,
          company_name,
          document,
          contact_name,
          email,
          phone,
          secondary_phone,
          street,
          number,
          complement,
          neighborhood,
          city,
          state,
          postal_code,
          notes,
          is_active,
          metadata,
          created_at,
          updated_at
        FROM public.clients
        WHERE LOWER(email) = LOWER($1)
        LIMIT 1;
      `,
      [email],
    );

    return result.rows[0] ? mapClientRow(result.rows[0]) : undefined;
  } catch (error) {
    normalizeSchemaError(error);
  }
}

async function findByDocument(document: string): Promise<Client | undefined> {
  try {
    const result = await pool.query<ClientRow>(
      `
        SELECT
          id::text AS id,
          name,
          company_name,
          document,
          contact_name,
          email,
          phone,
          secondary_phone,
          street,
          number,
          complement,
          neighborhood,
          city,
          state,
          postal_code,
          notes,
          is_active,
          metadata,
          created_at,
          updated_at
        FROM public.clients
        WHERE LOWER(document) = LOWER($1)
        LIMIT 1;
      `,
      [document],
    );

    return result.rows[0] ? mapClientRow(result.rows[0]) : undefined;
  } catch (error) {
    normalizeSchemaError(error);
  }
}

async function create(payload: CreateClientInput): Promise<Client> {
  try {
    const result = await pool.query<ClientRow>(
      `
        INSERT INTO public.clients (
          id,
          name,
          company_name,
          document,
          contact_name,
          email,
          phone,
          secondary_phone,
          street,
          number,
          complement,
          neighborhood,
          city,
          state,
          postal_code,
          notes,
          is_active,
          metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        RETURNING
          id::text AS id,
          name,
          company_name,
          document,
          contact_name,
          email,
          phone,
          secondary_phone,
          street,
          number,
          complement,
          neighborhood,
          city,
          state,
          postal_code,
          notes,
          is_active,
          metadata,
          created_at,
          updated_at;
      `,
      [
        randomUUID(),
        payload.name,
        payload.companyName ?? null,
        payload.document ?? null,
        payload.contactName ?? null,
        payload.email ?? null,
        payload.phone ?? null,
        payload.secondaryPhone ?? null,
        payload.street ?? null,
        payload.number ?? null,
        payload.complement ?? null,
        payload.neighborhood ?? null,
        payload.city ?? null,
        payload.state ?? null,
        payload.postalCode ?? null,
        payload.notes ?? null,
        payload.isActive,
        payload.metadata ?? {},
      ],
    );

    return mapClientRow(result.rows[0]);
  } catch (error) {
    normalizeSchemaError(error);
  }
}

async function update(id: string, payload: SaveClientInput): Promise<Client | undefined> {
  try {
    const result = await pool.query<ClientRow>(
      `
        UPDATE public.clients
        SET
          name = $2,
          company_name = $3,
          document = $4,
          contact_name = $5,
          email = $6,
          phone = $7,
          secondary_phone = $8,
          street = $9,
          number = $10,
          complement = $11,
          neighborhood = $12,
          city = $13,
          state = $14,
          postal_code = $15,
          notes = $16,
          is_active = $17,
          metadata = $18,
          updated_at = NOW()
        WHERE id::text = $1
        RETURNING
          id::text AS id,
          name,
          company_name,
          document,
          contact_name,
          email,
          phone,
          secondary_phone,
          street,
          number,
          complement,
          neighborhood,
          city,
          state,
          postal_code,
          notes,
          is_active,
          metadata,
          created_at,
          updated_at;
      `,
      [
        id,
        payload.name,
        payload.companyName,
        payload.document,
        payload.contactName,
        payload.email,
        payload.phone,
        payload.secondaryPhone,
        payload.street,
        payload.number,
        payload.complement,
        payload.neighborhood,
        payload.city,
        payload.state,
        payload.postalCode,
        payload.notes,
        payload.isActive,
        payload.metadata,
      ],
    );

    return result.rows[0] ? mapClientRow(result.rows[0]) : undefined;
  } catch (error) {
    normalizeSchemaError(error);
  }
}

async function remove(id: string): Promise<boolean> {
  try {
    const result = await pool.query(
      `
        DELETE FROM public.clients
        WHERE id::text = $1;
      `,
      [id],
    );

    return result.rowCount === 1;
  } catch (error) {
    normalizeSchemaError(error);
  }
}

export const clientRepository = {
  findAll,
  findById,
  findByEmail,
  findByDocument,
  create,
  update,
  remove,
};
