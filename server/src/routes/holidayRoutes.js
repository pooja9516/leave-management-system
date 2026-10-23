import { Router } from 'express';
import {
  listHolidays,
  createHoliday,
  updateHoliday,
  deleteHoliday,
} from '../controllers/holidayController.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';

const router = Router();

router.use(protect);

// Any logged-in user can view holidays; only admins can change them.
router.get('/', listHolidays);
router.post('/', authorize(ROLES.ADMIN), createHoliday);
router.patch('/:id', authorize(ROLES.ADMIN), updateHoliday);
router.delete('/:id', authorize(ROLES.ADMIN), deleteHoliday);

export default router;
