import app from './app';
import connectDB from './config/db';
import http from 'http';
import { Server } from 'socket.io'; // Импортируем Server из socket.io
import initializeSocket from './socket'; // Импортируем нашу будущую логику сокетов

// Подключение к базе данных
connectDB();

const PORT = process.env.PORT || 5001;

// Создаем HTTP сервер на основе нашего Express приложения
const server = http.createServer(app);

// Создаем экземпляр Socket.io сервера, привязывая его к нашему HTTP серверу
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // Разрешаем доступ нашему фронтенду
    methods: ["GET", "POST"]
  }
});

// Инициализируем всю логику обработки сокет-соединений
initializeSocket(io);

server.listen(PORT, () => console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`));