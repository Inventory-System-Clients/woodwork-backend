import { Request, Response } from "express";
import { employeeService } from "../services/employee.service";
import { asyncHandler } from "../utils/async-handler";

const list = asyncHandler(async (_req: Request, res: Response) => {
  const employees = await employeeService.listEmployees();
  res.status(200).json({ data: employees });
});

const getById = asyncHandler(async (req: Request, res: Response) => {
  const employee = await employeeService.getEmployeeById(req.params.id);
  res.status(200).json({ data: employee });
});

const create = asyncHandler(async (req: Request, res: Response) => {
  const employee = await employeeService.createEmployee(req.body);
  res.status(201).json({ data: employee });
});

const update = asyncHandler(async (req: Request, res: Response) => {
  const employee = await employeeService.updateEmployee(req.params.id, req.body);
  res.status(200).json({ data: employee });
});

const remove = asyncHandler(async (req: Request, res: Response) => {
  await employeeService.deleteEmployee(req.params.id);
  res.status(204).send();
});

export const employeeController = {
  list,
  getById,
  create,
  update,
  remove,
};
