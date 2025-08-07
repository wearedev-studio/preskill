// Import Engine
import { Request, Response } from 'express';

// Import Models
import GameRecord from '../models/GameRecord.model';
import Transaction from '../models/Transaction.model';
import User from '../models/User.model';

// Import Socket.IO
import { getIO } from '../socket';

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
export const getUserProfile = (req: Request, res: Response) => {
  // Middleware `protect` уже нашел пользователя и добавил его в req.user
  if (req.user) {
    res.json({
      _id: req.user._id,
      username: req.user.username,
      email: req.user.email,
      balance: req.user.balance,
      avatar: req.user.avatar,
      role: req.user.role,
      kycStatus: req.user.kycStatus,
      kycRejectionReason: req.user.kycRejectionReason
    });
  } else {
    // Эта ситуация маловероятна, если `protect` отработал корректно
    res.status(404).json({ message: 'User not found' });
  }
};

// @desc    Get user's game history
// @route   GET /api/users/history/games
// @access  Private
export const getGameHistory = async (req: Request, res: Response) => {
  try {
    const gameHistory = await GameRecord.find({ user: req.user?._id })
      .sort({ createdAt: -1 }); // Сортируем от новых к старым
    res.json(gameHistory);
  } catch (error: any) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get user's transaction history
// @route   GET /api/users/history/transactions
// @access  Private
export const getTransactionHistory = async (req: Request, res: Response) => {
  try {
    const transactionHistory = await Transaction.find({ user: req.user?._id })
      .sort({ createdAt: -1 });
    res.json(transactionHistory);
  } catch (error: any) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Update user password
// @route   PUT /api/users/profile/password
// @access  Private
export const updateUserPassword = async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Please provide current and new passwords' });
  }

  try {
    // 1. Находим пользователя, но в этот раз запрашиваем и его пароль
    const user = await User.findById(req.user?._id).select('+password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // 2. Проверяем, совпадает ли введенный текущий пароль с паролем в БД
    if (!(await user.comparePassword(currentPassword))) {
      return res.status(401).json({ message: 'Incorrect current password' });
    }

    // 3. Если все верно, обновляем пароль и сохраняем
    user.password = newPassword;
    await user.save(); // pre-save хук захеширует новый пароль

    res.json({ message: 'Password updated successfully' });
  } catch (error: any) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Update user balance (deposit/withdraw mock)
// @route   POST /api/users/balance
// @access  Private
export const updateUserBalance = async (req: Request, res: Response) => {
  const { amount } = req.body;
  const numericAmount = Number(amount);

  if (isNaN(numericAmount) || numericAmount === 0) {
    return res.status(400).json({ message: 'Invalid amount provided' });
  }
  
  const user = req.user!; // Мы уверены, что user есть, благодаря middleware `protect`

  // Проверка на достаточность средств при выводе
  if (numericAmount < 0 && user.balance < Math.abs(numericAmount)) {
    return res.status(400).json({ message: 'Insufficient funds for withdrawal' });
  }

  // Обновляем баланс
  user.balance += numericAmount;
  await user.save();

  // Создаем запись о транзакции
  const transaction = await Transaction.create({
    user: user._id,
    type: numericAmount > 0 ? 'DEPOSIT' : 'WITHDRAWAL',
    amount: Math.abs(numericAmount), // Сумма в транзакции всегда положительная
    status: 'COMPLETED',
  });

  // Отправляем обновление баланса через Socket.IO
  const io = getIO();
  if (io) {
    io.emit('balanceUpdated', {
      userId: (user._id as any).toString(),
      newBalance: user.balance,
      transaction: {
        type: transaction.type,
        amount: transaction.amount,
        status: transaction.status,
        createdAt: new Date()
      }
    });
  }

  // Возвращаем обновленные данные пользователя
  res.json({
    _id: user._id,
    username: user.username,
    email: user.email,
    balance: user.balance,
    avatar: user.avatar,
    kycStatus: user.kycStatus,
    role: user.role
  });
};

/**
 * @desc    Update user avatar
 * @route   PUT /api/users/profile/avatar
 * @access  Private
 */
export const updateUserAvatar = async (req: Request, res: Response) => {
    try {
        const user = await User.findById(req.user!._id);

        if (!user) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'Файл не загружен' });
        }

        // Сохраняем в базу данных путь к файлу
        // Убираем 'public' из пути, так как мы сделали ее статической
        const avatarPath = '/' + req.file.path.replace(/\\/g, '/').replace('public/', '');
        user.avatar = avatarPath;
        
        await user.save();

        res.json({
            _id: user._id,
            username: user.username,
            email: user.email,
            balance: user.balance,
            avatar: user.avatar,
            role: user.role
        });
    } catch (error: any) {
        res.status(500).json({ message: 'Ошибка сервера', error: error.message });
    }
};

/**
 * @desc    Submit KYC documents
 * @route   POST /api/users/kyc
 */
export const submitKyc = async (req: Request, res: Response) => {
    const { documentType } = req.body;
    const user = await User.findById(req.user!._id);

    if (!user) return res.status(404).json({ message: 'Пользователь не найден' });
    if (user.kycStatus === 'PENDING' || user.kycStatus === 'APPROVED') {
        return res.status(400).json({ message: 'Вы уже подали заявку или она одобрена.' });
    }
    if (!req.file) return res.status(400).json({ message: 'Файл документа не загружен.' });

    user.kycDocuments.push({
        documentType,
        filePath: req.file.path,
        submittedAt: new Date(),
    });
    user.kycStatus = 'PENDING';
    user.kycRejectionReason = undefined; // Очищаем причину отказа при новой подаче
    await user.save();

    // Отправляем обновление KYC статуса через Socket.IO
    const io = getIO();
    if (io) {
        io.emit('kycStatusUpdated', {
            userId: (user._id as any).toString(),
            kycStatus: user.kycStatus,
            kycRejectionReason: user.kycRejectionReason
        });
    }

    res.json({ status: user.kycStatus, message: 'The documents have been successfully submitted for verification.' });
};