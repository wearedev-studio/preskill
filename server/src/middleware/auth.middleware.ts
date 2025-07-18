import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import User, { IUser } from '../models/User.model';

// Расширяем интерфейс Request из Express, чтобы он мог содержать данные пользователя
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

export const protect = async (req: Request, res: Response, next: NextFunction) => {
  let token;

  // 1. Проверяем наличие заголовка Authorization и его корректность
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // 2. Извлекаем токен из заголовка
      token = req.headers.authorization.split(' ')[1];

      // 3. Верифицируем токен
      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;

      // 4. Находим пользователя по ID из токена и добавляем его в объект запроса
      // Исключаем пароль из выборки для безопасности
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json({ message: 'Not authorized, user not found' });
      }

      next(); // Передаем управление следующему middleware
    } catch (error) {
      console.error(error);
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};