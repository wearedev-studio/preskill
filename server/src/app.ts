// Import Engine
import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path'; // 1. Импортируем path

// Import Routes
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import adminRoutes from './routes/admin.routes';
import tournamentRoutes from './routes/tournament.routes'; // 1. Импорт
import notificationRoutes from './routes/notification.routes';

dotenv.config();

const app: Application = express();

// 2. Делаем папку 'public' статической, чтобы файлы из нее были доступны по URL
app.use(express.static(path.join(__dirname, '..', 'public')));

// Connecting Middlewares
app.use(cors());
app.use(express.json());

// Base Route
app.get('/', (req: Request, res: Response) => {
    res.send('API is running...');
});

// Connecting Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/tournaments', tournamentRoutes); // 2. Подключение
app.use('/api/notifications', notificationRoutes);

export default app;