import { Request, Response } from 'express';
import User from '../models/User.model';
import generateToken from '../utils/generateToken'; // Импортируем наш генератор токена

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
export const registerUser = async (req: Request, res: Response) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ message: 'Please enter all fields' });
    }

    try {
        const userExists = await User.findOne({ $or: [{ email }, { username }] });

        if (userExists) {
            return res.status(400).json({ message: 'User with this email or username already exists' });
        }

        const user = await User.create({
            username,
            email,
            password,
        });

        res.status(201).json({
            _id: user._id,
            username: user.username,
            email: user.email,
            balance: user.balance,
            avatar: user.avatar,
            role: user.role,
            // @ts-ignore
            token: generateToken(user._id),
        });
    } catch (error: any) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
export const loginUser = async (req: Request, res: Response) => {
    const { email, password } = req.body;

    // 1. Простая валидация
    if (!email || !password) {
        return res.status(400).json({ message: 'Please enter email and password' });
    }

    try {
        // 2. Ищем пользователя и явно запрашиваем пароль
        const user = await User.findOne({ email }).select('+password');

        // 3. Проверяем, что пользователь найден и пароль совпадает
        if (user && (await user.comparePassword(password))) {
            // 4. Генерируем токен и отправляем данные пользователя
            res.json({
                _id: user._id,
                username: user.username,
                email: user.email,
                balance: user.balance,
                avatar: user.avatar,
                role: user.role,
                // @ts-ignore
                token: generateToken(user._id),
            });
        } else {
            res.status(401).json({ message: 'Invalid email or password' });
        }
    } catch (error: any) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = async (req: Request, res: Response) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ message: 'Please provide an email' });
    }

    try {
        const user = await User.findOne({ email });

        // Важно: всегда отправляем успешный ответ, чтобы не раскрывать,
        // какие email зарегистрированы в системе.
        if (!user) {
            return res.status(200).json({ message: 'If a user with that email exists, a password reset link has been sent.' });
        }

        // Генерируем простой 6-значный код
        const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
        // Устанавливаем срок жизни кода - 10 минут
        const resetExpires = new Date(Date.now() + 10 * 60 * 1000);

        user.passwordResetCode = resetCode;
        user.passwordResetExpires = resetExpires;
        await user.save();

        // !!! ВНИМАНИЕ: В РЕАЛЬНОМ ПРИЛОЖЕНИИ ЗДЕСЬ БУДЕТ ОТПРАВКА EMAIL !!!
        // Для разработки мы выводим код в консоль и возвращаем в ответе.
        // В продакшене эту строку нужно удалить.
        console.log(`Password Reset Code for ${email}: ${resetCode}`);

        res.status(200).json({
            message: `Password reset code sent to console. In production, this would be sent to your email. The code is: ${resetCode}`,
            // Временный ответ для упрощения разработки
            developer_note: "This response includes the reset code for testing purposes only."
        });

    } catch (error: any) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Reset password
// @route   POST /api/auth/reset-password
// @access  Public
export const resetPassword = async (req: Request, res: Response) => {
    const { email, secretCode, newPassword } = req.body;
    if (!email || !secretCode || !newPassword) {
        return res.status(400).json({ message: 'Please provide email, secret code, and a new password' });
    }

    try {
        // Ищем пользователя по коду, email и проверяем, что срок жизни кода не истек.
        // Явно запрашиваем поля для сброса.
        const user = await User.findOne({
            email,
            passwordResetCode: secretCode,
            passwordResetExpires: { $gt: Date.now() },
        }).select('+passwordResetCode +passwordResetExpires');

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired reset code' });
        }

        // Устанавливаем новый пароль
        user.password = newPassword;
        // Очищаем поля для сброса
        user.passwordResetCode = undefined;
        user.passwordResetExpires = undefined;

        await user.save(); // pre-save хук автоматически захеширует пароль

        res.status(200).json({ message: 'Password has been reset successfully. Please log in.' });

    } catch (error: any) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};
