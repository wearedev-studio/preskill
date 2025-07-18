import { Router } from 'express';
// Импортируем новые функции
import { 
  registerUser, 
  loginUser, 
  forgotPassword, 
  resetPassword 
} from '../controllers/auth.controller';

const router = Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/forgot-password', forgotPassword); // Новый роут
router.post('/reset-password', resetPassword);   // Новый роут

export default router;