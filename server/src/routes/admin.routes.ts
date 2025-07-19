import { Router } from 'express';
import { createAdminRoom } from '../controllers/admin.controller';
import { adminProtect } from '../middleware/admin.middleware';

const router = Router();

router.route('/create-room').post(adminProtect, createAdminRoom);

export default router;
