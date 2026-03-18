import {
  Client,
  CreateClientInput,
  ListClientsQueryInput,
  UpdateClientInput,
} from "../models/client.model";
import { clientRepository, SaveClientInput } from "../repositories/client.repository";
import { AppError } from "../utils/app-error";

function normalizeOptionalIdentifier(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

async function ensureUniqueClientEmail(email: string | null, excludedId?: string): Promise<void> {
  if (!email) {
    return;
  }

  const existingClient = await clientRepository.findByEmail(email);

  if (existingClient && existingClient.id !== excludedId) {
    throw new AppError("Client email is already in use", 409);
  }
}

async function ensureUniqueClientDocument(document: string | null, excludedId?: string): Promise<void> {
  if (!document) {
    return;
  }

  const existingClient = await clientRepository.findByDocument(document);

  if (existingClient && existingClient.id !== excludedId) {
    throw new AppError("Client document is already in use", 409);
  }
}

function mapCreatePayload(payload: CreateClientInput): CreateClientInput {
  return {
    ...payload,
    document: normalizeOptionalIdentifier(payload.document),
    email: normalizeOptionalIdentifier(payload.email),
    metadata: payload.metadata ?? {},
  };
}

function mapSavePayload(existingClient: Client, payload: UpdateClientInput): SaveClientInput {
  return {
    name: payload.name ?? existingClient.name,
    companyName: payload.companyName !== undefined ? payload.companyName : existingClient.companyName,
    document:
      payload.document !== undefined
        ? normalizeOptionalIdentifier(payload.document)
        : normalizeOptionalIdentifier(existingClient.document),
    contactName: payload.contactName !== undefined ? payload.contactName : existingClient.contactName,
    email:
      payload.email !== undefined
        ? normalizeOptionalIdentifier(payload.email)
        : normalizeOptionalIdentifier(existingClient.email),
    phone: payload.phone !== undefined ? payload.phone : existingClient.phone,
    secondaryPhone:
      payload.secondaryPhone !== undefined ? payload.secondaryPhone : existingClient.secondaryPhone,
    street: payload.street !== undefined ? payload.street : existingClient.street,
    number: payload.number !== undefined ? payload.number : existingClient.number,
    complement: payload.complement !== undefined ? payload.complement : existingClient.complement,
    neighborhood: payload.neighborhood !== undefined ? payload.neighborhood : existingClient.neighborhood,
    city: payload.city !== undefined ? payload.city : existingClient.city,
    state: payload.state !== undefined ? payload.state : existingClient.state,
    postalCode: payload.postalCode !== undefined ? payload.postalCode : existingClient.postalCode,
    notes: payload.notes !== undefined ? payload.notes : existingClient.notes,
    isActive: payload.isActive !== undefined ? payload.isActive : existingClient.isActive,
    metadata: payload.metadata !== undefined ? payload.metadata ?? {} : existingClient.metadata,
  };
}

async function listClients(query: ListClientsQueryInput): Promise<Client[]> {
  return clientRepository.findAll(query.search, query.isActive);
}

async function getClientById(id: string): Promise<Client> {
  const client = await clientRepository.findById(id);

  if (!client) {
    throw new AppError("Client not found", 404);
  }

  return client;
}

async function createClient(payload: CreateClientInput): Promise<Client> {
  const normalizedPayload = mapCreatePayload(payload);

  await ensureUniqueClientEmail(normalizedPayload.email ?? null);
  await ensureUniqueClientDocument(normalizedPayload.document ?? null);

  return clientRepository.create(normalizedPayload);
}

async function updateClient(id: string, payload: UpdateClientInput): Promise<Client> {
  const existingClient = await clientRepository.findById(id);

  if (!existingClient) {
    throw new AppError("Client not found", 404);
  }

  const savePayload = mapSavePayload(existingClient, payload);

  await ensureUniqueClientEmail(savePayload.email, id);
  await ensureUniqueClientDocument(savePayload.document, id);

  const updatedClient = await clientRepository.update(id, savePayload);

  if (!updatedClient) {
    throw new AppError("Client not found", 404);
  }

  return updatedClient;
}

async function deleteClient(id: string): Promise<void> {
  const wasDeleted = await clientRepository.remove(id);

  if (!wasDeleted) {
    throw new AppError("Client not found", 404);
  }
}

export const clientService = {
  listClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
};
