import { Router } from 'express';
import { getAllTournaments, getTournamentDetails, registerInTournament  } from '../controllers/tournament.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

router.route('/').get(getAllTournaments);
router.route('/:id').get(getTournamentDetails);
router.route('/:id/register').post(protect, registerInTournament); // Новый защищенный роут

export default router;