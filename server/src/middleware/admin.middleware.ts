import { Request, Response, NextFunction } from 'express';
import { protect } from './auth.middleware'; // Мы будем использовать существующий `protect`

export const admin = (req: Request, res: Response, next: NextFunction) => {
    if (req.user && req.user.role === 'ADMIN') {
        next();
    } else {
        res.status(403).json({ message: 'Доступ запрещен. Требуются права администратора.' });
    }
};

// Комбинированный экспорт для удобства
export const adminProtect = [protect, admin];