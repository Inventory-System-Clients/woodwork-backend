import { Request, Response } from "express";
import { authService } from "../services/auth.service";
import { AppError } from "../utils/app-error";
import { asyncHandler } from "../utils/async-handler";

const login = asyncHandler(async (req: Request, res: Response) => {
  const data = await authService.login(req.body);
  res.status(200).json({ data });
});

const me = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.authUser?.id;

  if (!userId) {
    throw new AppError("Unauthorized", 401);
  }

  const currentUser = await authService.getCurrentUser(userId);
  res.status(200).json({ data: currentUser });
});

export const authController = {
  login,
  me,
};
