# Preskill - Онлайн игровая платформа

Стабильная система для онлайн игр в шашки, шахматы, нарды и крестики-нолики с турнирной системой.

## 🚀 Основные возможности

- **4 игры**: Шашки, Шахматы, Нарды, Крестики-нолики
- **Турнирная система**: Олимпийская система с ботами
- **Система ставок**: Игры на деньги с комиссией платформы
- **KYC верификация**: Проверка документов для вывода средств
- **Многоязычность**: Русский и английский языки
- **Реальное время**: WebSocket соединения
- **CRM система**: Административная панель

## 🏗️ Архитектура

```
preskill/
├── server/          # Backend (Node.js + Express + Socket.io)
├── client/          # Frontend (React + Vite + TypeScript)
└── crm-client/      # CRM система (React + Vite)
```

## 🛠️ Технологии

### Backend
- **Node.js** + **Express** + **TypeScript**
- **MongoDB** + **Mongoose**
- **Socket.io** для реального времени
- **JWT** для аутентификации
- **bcryptjs** для хеширования паролей
- **chess.js** для логики шахмат

### Frontend
- **React 19** + **TypeScript**
- **Vite** для сборки
- **TailwindCSS** для стилей
- **React Router** для навигации
- **Socket.io-client** для WebSocket
- **react-chessboard** для шахматной доски

## 📦 Установка и запуск

### Предварительные требования
- Node.js 18+
- MongoDB
- Git

### 1. Клонирование репозитория
```bash
git clone <repository-url>
cd preskill
```

### 2. Установка зависимостей

#### Backend
```bash
cd server
npm install
```

#### Frontend
```bash
cd client
npm install
```

#### CRM
```bash
cd crm-client
npm install
```

### 3. Настройка окружения

Создайте файл `server/.env`:
```env
PORT=5001
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/preskill
JWT_SECRET=your_very_secret_key_here
JWT_EXPIRES_IN=30d
```

### 4. Запуск приложения

#### Запуск MongoDB
```bash
mongod
```

#### Запуск Backend
```bash
cd server
npm run dev
```

#### Запуск Frontend
```bash
cd client
npm run dev
```

#### Запуск CRM
```bash
cd crm-client
npm run dev
```

### 5. Доступ к приложениям
- **Frontend**: http://localhost:5173
- **CRM**: http://localhost:5174
- **Backend API**: http://localhost:5001

## 🎮 Игровая логика

### Шашки
- Русские шашки на доске 8x8
- Обязательное взятие
- Превращение в дамки
- Серийные взятия

### Шахматы
- Стандартные правила FIDE
- Превращение пешек
- Мат, пат, ничья
- История ходов

### Нарды
- Длинные нарды
- Бросок костей
- Вывод шашек
- Правила блокировки

### Крестики-нолики
- Классические правила 3x3
- Простая логика для демонстрации

## 🏆 Турнирная система

### Особенности
- Олимпийская система (на выбывание)
- Автоматическое заполнение ботами
- Призовой фонд из взносов участников
- Комиссия платформы 10%
- Уведомления о матчах

### Процесс турнира
1. Регистрация игроков
2. Автоматический старт по времени
3. Создание турнирной сетки
4. Матчи в реальном времени
5. Продвижение победителей
6. Награждение финалиста

## 💰 Экономическая модель

### Обычные игры
- Игроки делают ставки
- Победитель получает удвоенную ставку
- Комиссия платформы: 10%

### Турниры
- Взнос за участие
- Призовой фонд = сумма взносов
- Комиссия платформы: 10%

### KYC и выводы
- Обязательная верификация для вывода
- 4 типа документов на выбор
- Модерация в CRM системе

## 🔧 Разработка

### Структура кода

#### Backend
```
server/src/
├── config/          # Конфигурация БД и файлов
├── controllers/     # Контроллеры API
├── games/          # Логика игр
├── middleware/     # Промежуточное ПО
├── models/         # Модели MongoDB
├── routes/         # Маршруты API
├── services/       # Бизнес-логика
├── types/          # TypeScript типы
└── utils/          # Утилиты
```

#### Frontend
```
client/src/
├── components/     # React компоненты
├── context/        # React контексты
├── pages/          # Страницы приложения
├── services/       # API сервисы
├── styles/         # Стили
└── types/          # TypeScript типы
```

### Основные принципы
- **ООП**: Объектно-ориентированное программирование
- **SOLID**: Принципы проектирования
- **TypeScript**: Строгая типизация
- **Модульность**: Разделение ответственности
- **Масштабируемость**: Готовность к росту

### Игровые модули
Каждая игра реализует интерфейс `IGameLogic`:
```typescript
interface IGameLogic {
    createInitialState(players: GamePlayer[]): GameState;
    processMove(gameState: GameState, move: GameMove, playerId: string, players: GamePlayer[]): IMoveResult;
    checkGameEnd(gameState: GameState, players: GamePlayer[]): IGameResult;
    makeBotMove(gameState: GameState, playerIndex: 0 | 1): GameMove;
}
```

## 🧪 Тестирование

### Ручное тестирование
1. Регистрация и авторизация
2. Создание и присоединение к играм
3. Игровой процесс
4. Турниры
5. Транзакции и KYC

### Тестовые сценарии
- Игра человек vs человек
- Игра человек vs бот
- Турнир с ботами
- Отключения и переподключения
- Валидация ходов

## 🚀 Деплой

### Production сборка

#### Backend
```bash
cd server
npm run build
npm start
```

#### Frontend
```bash
cd client
npm run build
```

#### CRM
```bash
cd crm-client
npm run build
```

### Docker (опционально)
```dockerfile
# Пример Dockerfile для backend
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 5001
CMD ["npm", "start"]
```

## 🔒 Безопасность

- JWT токены для аутентификации
- Хеширование паролей bcrypt
- Валидация всех входных данных
- CORS настройки
- Защита от SQL инъекций (NoSQL)

## 📝 API Документация

### Основные эндпоинты

#### Аутентификация
- `POST /api/auth/register` - Регистрация
- `POST /api/auth/login` - Вход
- `POST /api/auth/forgot-password` - Сброс пароля

#### Пользователи
- `GET /api/users/profile` - Профиль пользователя
- `PUT /api/users/profile` - Обновление профиля
- `POST /api/users/kyc` - Загрузка KYC документов

#### Турниры
- `GET /api/tournaments` - Список турниров
- `GET /api/tournaments/:id` - Детали турнира
- `POST /api/tournaments/:id/register` - Регистрация в турнире

#### Администрирование
- `GET /api/admin/users` - Список пользователей
- `POST /api/admin/tournaments` - Создание турнира
- `PUT /api/admin/kyc/:id` - Модерация KYC

## 🐛 Известные проблемы и решения

### Исправленные проблемы
✅ Логика турниров - исправлена обработка ботов и продвижение игроков  
✅ Шахматы в турнирах - добавлена правильная валидация ходов  
✅ Фронтенд турниров - улучшена обработка состояний  
✅ Типизация TypeScript - добавлены строгие типы  

### Потенциальные улучшения
- Добавление рейтинговой системы
- Реплеи игр
- Чат в играх
- Push уведомления
- Мобильная версия

## 🤝 Вклад в проект

1. Fork репозитория
2. Создайте feature ветку
3. Внесите изменения
4. Добавьте тесты
5. Создайте Pull Request

## 📄 Лицензия

MIT License - см. файл LICENSE

## 📞 Поддержка

Для вопросов и поддержки создавайте Issues в репозитории.

---

**Preskill** - современная платформа для онлайн игр с турнирной системой и монетизацией.