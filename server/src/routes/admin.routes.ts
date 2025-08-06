import { Router } from 'express';
import {
    createAdminRoom,
    getActiveRooms,
    deleteRoom,
    createTournament,
    updateTournament,
    deleteTournament,
    getAllUsers,
    getUserById,
    updateUser,
    deleteUser,
    getAllTransactions,
    getAllGameRecords,
    getKycSubmissions,
    reviewKycSubmission,
    getKycDocument
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

// --- НОВЫЕ РОУТЫ ДЛЯ ПОЛЬЗОВАТЕЛЕЙ ---
router.route('/users').get(adminProtect, getAllUsers);
router.route('/users/:id')
    .get(adminProtect, getUserById)
    .put(adminProtect, updateUser)
    .delete(adminProtect, deleteUser);

// --- Роуты для просмотра данных ---
router.route('/transactions').get(adminProtect, getAllTransactions);
router.route('/games').get(adminProtect, getAllGameRecords);

// --- НОВЫЕ РОУТЫ ДЛЯ KYC ---
router.route('/kyc-submissions').get(adminProtect, getKycSubmissions);
router.route('/kyc-submissions/:userId/review').post(adminProtect, reviewKycSubmission);

// --- НОВЫЙ РОУТ ДЛЯ ПРОСМОТРА ДОКУМЕНТОВ ---
router.route('/kyc-document/:userId/:fileName').get(adminProtect, getKycDocument);

export default router;
