import { Router } from 'express';
import {
    createAdminRoom,
    getActiveRooms,
    deleteRoom,
    createTournament,
    updateTournament,
    deleteTournament,
    startTournamentManually,
    getAllUsers,
    getUserById,
    updateUser,
    deleteUser,
    getAllTransactions,
    getAllGameRecords
} from '../controllers/admin.controller';
import { adminProtect } from '../middleware/admin.middleware';

const router = Router();

router.route('/create-room').post(adminProtect, createAdminRoom);
router.route('/rooms').get(adminProtect, getActiveRooms);
router.route('/rooms/:roomId').delete(adminProtect, deleteRoom);
// --- Роуты для Турниров ---
router.route('/tournaments').post(adminProtect, createTournament);
router.route('/tournaments/:id')
    .put(adminProtect, updateTournament)
    .delete(adminProtect, deleteTournament);
router.route('/tournaments/:id/start').post(adminProtect, startTournamentManually);

// --- НОВЫЕ РОУТЫ ДЛЯ ПОЛЬЗОВАТЕЛЕЙ ---
router.route('/users').get(adminProtect, getAllUsers);
router.route('/users/:id')
    .get(adminProtect, getUserById)
    .put(adminProtect, updateUser)
    .delete(adminProtect, deleteUser);

// --- Роуты для просмотра данных ---
router.route('/transactions').get(adminProtect, getAllTransactions);
router.route('/games').get(adminProtect, getAllGameRecords);


export default router;
