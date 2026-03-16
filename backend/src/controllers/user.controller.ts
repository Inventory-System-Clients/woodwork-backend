import { Request, Response } from "express";
import { userService } from "../services/user.service";
import { asyncHandler } from "../utils/async-handler";

const list = asyncHandler(async (_req: Request, res: Response) => {
  const users = userService.listUsers();
  res.status(200).json({ data: users });
});

const getById = asyncHandler(async (req: Request, res: Response) => {
  const user = userService.getUserById(req.params.id);
  res.status(200).json({ data: user });
});

const create = asyncHandler(async (req: Request, res: Response) => {
  const user = userService.createUser(req.body);
  res.status(201).json({ data: user });
});

const update = asyncHandler(async (req: Request, res: Response) => {
  const user = userService.updateUser(req.params.id, req.body);
  res.status(200).json({ data: user });
});

const remove = asyncHandler(async (req: Request, res: Response) => {
  userService.deleteUser(req.params.id);
  res.status(204).send();
});

export const userController = {
  list,
  getById,
  create,
  update,
  remove,
};