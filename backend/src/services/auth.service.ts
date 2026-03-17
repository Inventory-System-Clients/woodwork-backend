import jwt, { SignOptions } from "jsonwebtoken";
import { env } from "../config/env";
import { EmployeeRole } from "../models/employee.model";
import { LoginInput } from "../models/auth.model";
import { employeeRepository } from "../repositories/employee.repository";
import { AppError } from "../utils/app-error";
import { verifyPassword } from "../utils/password";

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: EmployeeRole;
}

function buildAuthenticatedUser(input: {
  id: string;
  name: string;
  email: string;
  role: EmployeeRole;
}): AuthenticatedUser {
  return {
    id: input.id,
    name: input.name,
    email: input.email,
    role: input.role,
  };
}

function signToken(user: AuthenticatedUser): string {
  const signOptions: SignOptions = {
    subject: user.id,
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
  };

  return jwt.sign({ role: user.role, email: user.email }, env.JWT_SECRET, signOptions);
}

async function login(payload: LoginInput): Promise<{ token: string; user: AuthenticatedUser }> {
  const employee = await employeeRepository.findAuthByEmail(payload.email);

  if (!employee || !employee.passwordHash) {
    throw new AppError("Invalid email or password", 401);
  }

  if (!employee.isActive) {
    throw new AppError("User is inactive", 403);
  }

  const validPassword = await verifyPassword(payload.password, employee.passwordHash);

  if (!validPassword) {
    throw new AppError("Invalid email or password", 401);
  }

  const user = buildAuthenticatedUser(employee);

  return {
    token: signToken(user),
    user,
  };
}

async function getCurrentUser(id: string): Promise<AuthenticatedUser> {
  const employee = await employeeRepository.findAuthById(id);

  if (!employee || !employee.isActive) {
    throw new AppError("Unauthorized", 401);
  }

  return buildAuthenticatedUser(employee);
}

export const authService = {
  login,
  getCurrentUser,
};
