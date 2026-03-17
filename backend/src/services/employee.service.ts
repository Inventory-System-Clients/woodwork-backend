import bcrypt from "bcryptjs";
import { CreateEmployeeInput, Employee, UpdateEmployeeInput } from "../models/employee.model";
import { employeeRepository } from "../repositories/employee.repository";
import { AppError } from "../utils/app-error";

const PASSWORD_SALT_ROUNDS = 10;

function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
}

async function listEmployees(): Promise<Employee[]> {
  return employeeRepository.findAll();
}

async function getEmployeeById(id: string): Promise<Employee> {
  const employee = await employeeRepository.findById(id);

  if (!employee) {
    throw new AppError("Employee not found", 404);
  }

  return employee;
}

async function createEmployee(payload: CreateEmployeeInput): Promise<Employee> {
  const emailInUse = await employeeRepository.findByEmail(payload.email);

  if (emailInUse) {
    throw new AppError("Email is already in use", 409);
  }

  const passwordHash = await hashPassword(payload.password);
  return employeeRepository.create(payload, passwordHash);
}

async function updateEmployee(id: string, payload: UpdateEmployeeInput): Promise<Employee> {
  const existingEmployee = await employeeRepository.findById(id);
  const existingAuthEmployee = await employeeRepository.findAuthById(id);

  if (!existingEmployee || !existingAuthEmployee) {
    throw new AppError("Employee not found", 404);
  }

  if (payload.email && payload.email !== existingEmployee.email) {
    const emailInUse = await employeeRepository.findByEmail(payload.email);

    if (emailInUse && emailInUse.id !== id) {
      throw new AppError("Email is already in use", 409);
    }
  }

  const updatedEmployee = await employeeRepository.update(id, {
    name: payload.name ?? existingEmployee.name,
    position: payload.position !== undefined ? payload.position : existingEmployee.position,
    phone: payload.phone !== undefined ? payload.phone : existingEmployee.phone,
    email: payload.email ?? existingEmployee.email,
    role: payload.role ?? existingEmployee.role,
    isActive: payload.isActive ?? existingEmployee.isActive,
    passwordHash: payload.password
      ? await hashPassword(payload.password)
      : existingAuthEmployee.passwordHash,
  });

  if (!updatedEmployee) {
    throw new AppError("Employee not found", 404);
  }

  return updatedEmployee;
}

async function deleteEmployee(id: string): Promise<void> {
  const wasDeleted = await employeeRepository.remove(id);

  if (!wasDeleted) {
    throw new AppError("Employee not found", 404);
  }
}

export const employeeService = {
  listEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
};
