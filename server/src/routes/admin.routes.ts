import { Router } from 'express';
import { createAdminRoom, createTournament, startTournamentManually } from '../controllers/admin.controller';
import { adminProtect } from '../middleware/admin.middleware';

const router = Router();

router.route('/create-room').post(adminProtect, createAdminRoom);
router.route('/tournaments').post(adminProtect, createTournament);
router.route('/tournaments/:id/start').post(adminProtect, startTournamentManually); // Новый роут


export default router;
