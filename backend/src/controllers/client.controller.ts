import { Request, Response } from "express";
import { listClientsQuerySchema } from "../models/client.model";
import { clientService } from "../services/client.service";
import { asyncHandler } from "../utils/async-handler";

function toOptionalQueryString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

const list = asyncHandler(async (req: Request, res: Response) => {
  const query = listClientsQuerySchema.parse({
    search: toOptionalQueryString(req.query.search),
    isActive: toOptionalQueryString(req.query.isActive),
  });

  const clients = await clientService.listClients(query);
  res.status(200).json({ data: clients });
});

const getById = asyncHandler(async (req: Request, res: Response) => {
  const client = await clientService.getClientById(req.params.id);
  res.status(200).json({ data: client });
});

const create = asyncHandler(async (req: Request, res: Response) => {
  const client = await clientService.createClient(req.body);
  res.status(201).json({ data: client });
});

const update = asyncHandler(async (req: Request, res: Response) => {
  const client = await clientService.updateClient(req.params.id, req.body);
  res.status(200).json({ data: client });
});

const remove = asyncHandler(async (req: Request, res: Response) => {
  await clientService.deleteClient(req.params.id);
  res.status(204).send();
});

export const clientController = {
  list,
  getById,
  create,
  update,
  remove,
};
