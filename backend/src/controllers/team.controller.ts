import { Request, Response } from "express";
import { teamService } from "../services/team.service";
import { asyncHandler } from "../utils/async-handler";

const list = asyncHandler(async (_req: Request, res: Response) => {
  const teams = await teamService.listTeams();
  res.status(200).json({ data: teams });
});

const getById = asyncHandler(async (req: Request, res: Response) => {
  const team = await teamService.getTeamById(req.params.id);
  res.status(200).json({ data: team });
});

const create = asyncHandler(async (req: Request, res: Response) => {
  const team = await teamService.createTeam(req.body);
  res.status(201).json({ data: team });
});

const update = asyncHandler(async (req: Request, res: Response) => {
  const team = await teamService.updateTeam(req.params.id, req.body);
  res.status(200).json({ data: team });
});

const setMembers = asyncHandler(async (req: Request, res: Response) => {
  const team = await teamService.setTeamMembers(req.params.id, req.body);
  res.status(200).json({ data: team });
});

const remove = asyncHandler(async (req: Request, res: Response) => {
  await teamService.deleteTeam(req.params.id);
  res.status(204).send();
});

export const teamController = {
  list,
  getById,
  create,
  update,
  setMembers,
  remove,
};
