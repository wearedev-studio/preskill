import { Server } from 'socket.io';
import Notification from '../models/Notification.model';
import { userSocketMap } from '../socket';

interface NotificationData {
    title: string;
    message: string;
    link?: string;
}

export async function createNotification(io: Server, userId: string, data: NotificationData) {
    // 1. Сохраняем уведомление в базу данных
    const notification = await Notification.create({ user: userId, ...data });

    // 2. Если пользователь онлайн, отправляем ему уведомление через сокет
    const socketId = userSocketMap[userId];
    if (socketId) {
        io.to(socketId).emit('newNotification', notification);
    }
}