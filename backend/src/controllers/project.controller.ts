import { Request, Response } from "express";
import { projectService } from "../services/project.service";
import { asyncHandler } from "../utils/async-handler";

const list = asyncHandler(async (req: Request, res: Response) => {
  const data =
    req.authUser?.role === "funcionario"
      ? await projectService.listForEmployee()
      : await projectService.listForAdmin();

  res.status(200).json({ data });
});

const dashboard = asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).json({ data: await projectService.getDashboard() });
});

const getById = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json({ data: await projectService.getDetail(req.params.id) });
});

const create = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json({ data: await projectService.createProject(req.body) });
});

const update = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json({ data: await projectService.updateProject(req.params.id, req.body) });
});

const addCost = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json({ data: await projectService.addCost(req.params.id, req.body) });
});

const markCostPaid = asyncHandler(async (req: Request, res: Response) => {
  const cost = await projectService.setCostPaid(req.params.id, req.params.costId, true, req.body.paidAt);
  res.status(200).json({ data: cost });
});

const markCostUnpaid = asyncHandler(async (req: Request, res: Response) => {
  const cost = await projectService.setCostPaid(req.params.id, req.params.costId, false);
  res.status(200).json({ data: cost });
});

const removeCost = asyncHandler(async (req: Request, res: Response) => {
  await projectService.removeCost(req.params.id, req.params.costId);
  res.status(200).json({ data: { id: req.params.costId } });
});

export const projectController = {
  list,
  dashboard,
  getById,
  create,
  update,
  addCost,
  markCostPaid,
  markCostUnpaid,
  removeCost,
};
