import { Router } from 'express';
import { 
    getAllTournaments, 
    getTournament, 
    createNewTournament,
    registerInTournament,
    unregisterFromTournament,
    getPlayerTournaments,
    getTournamentHistory,
    getTournamentStats
} from '../controllers/tournament.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

router.route('/').get(getAllTournaments);
router.route('/history').get(getTournamentHistory);
router.route('/stats').get(getTournamentStats);
router.route('/:tournamentId').get(getTournament);

router.route('/').post(protect, createNewTournament);
router.route('/player').get(protect, getPlayerTournaments);
router.route('/:tournamentId/register').post(protect, registerInTournament);
router.route('/:tournamentId/register').delete(protect, unregisterFromTournament);

export default router;