import { EmployeeRole } from "../models/employee.model";

declare global {
  namespace Express {
    interface Request {
      authUser?: {
        id: string;
        name: string;
        email: string;
        role: EmployeeRole;
      };
    }
  }
}

export {};
