import { Router } from 'express';
import {
  calculateDays,
  getMyBalance,
  createLeave,
  listMyLeaves,
  cancelMyLeave,
  listTeamLeaves,
  listAllLeaves,
  approveLeave,
  rejectLeave,
} from '../controllers/leaveController.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';

const router = Router();

router.use(protect);

router.get('/calculate', calculateDays);
router.get('/balance', getMyBalance);
// Admins have no approver, so only employees and managers apply for leave.
const applicants = authorize(ROLES.EMPLOYEE, ROLES.MANAGER);
router.post('/', applicants, createLeave);
router.get('/my', applicants, listMyLeaves);
router.patch('/:id/cancel', applicants, cancelMyLeave);

// Managers review leaves of their own team (checked per leave); admins can review any leave.
const reviewers = authorize(ROLES.MANAGER, ROLES.ADMIN);
router.get('/team', authorize(ROLES.MANAGER), listTeamLeaves);
router.patch('/:id/approve', reviewers, approveLeave);
router.patch('/:id/reject', reviewers, rejectLeave);

router.get('/all', authorize(ROLES.ADMIN), listAllLeaves);

export default router;
