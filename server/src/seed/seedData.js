import { ROLES } from '../config/constants.js';

export const SEED_PASSWORD = 'Password@123';

export const seedUsers = [
  { name: 'Admin User', email: 'admin@example.com', role: ROLES.ADMIN },
  { name: 'Manager One', email: 'manager1@example.com', role: ROLES.MANAGER },
  // Manager Two reports to Manager One, so manager leave approval can be demonstrated.
  { name: 'Manager Two', email: 'manager2@example.com', role: ROLES.MANAGER, managerEmail: 'manager1@example.com' },
  { name: 'Employee One', email: 'employee1@example.com', role: ROLES.EMPLOYEE, managerEmail: 'manager1@example.com' },
  { name: 'Employee Two', email: 'employee2@example.com', role: ROLES.EMPLOYEE, managerEmail: 'manager1@example.com' },
  { name: 'Employee Three', email: 'employee3@example.com', role: ROLES.EMPLOYEE, managerEmail: 'manager2@example.com' },
  { name: 'Employee Four', email: 'employee4@example.com', role: ROLES.EMPLOYEE, managerEmail: 'manager2@example.com' },
];

export const seedHolidays = [
  { name: 'Republic Day', date: '2026-01-26' },
  { name: 'Independence Day', date: '2026-08-15' },
  { name: 'Gandhi Jayanti', date: '2026-10-02' },
  { name: 'Christmas', date: '2026-12-25' },
  { name: 'Republic Day', date: '2027-01-26' },
];
