import { Router } from 'express';
import {
    getUserProfile,
    getGameHistory,
    getTransactionHistory,
    updateUserPassword,
    updateUserBalance,
} from '../controllers/user.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

router.route('/profile').get(protect, getUserProfile);

router.route('/history/games').get(protect, getGameHistory);
router.route('/history/transactions').get(protect, getTransactionHistory);

router.route('/profile/password').put(protect, updateUserPassword);
router.route('/balance').post(protect, updateUserBalance);

export default router;