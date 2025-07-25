import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Создаем папку для загрузок, если ее нет
const uploadDir = 'public/uploads/avatars';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Настройка хранилища
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Создаем уникальное имя файла: userId-timestamp.ext
        const uniqueSuffix = Date.now() + path.extname(file.originalname);
        cb(null, req.user!._id + '-' + uniqueSuffix);
    }
});

// Фильтр файлов (принимаем только картинки)
const fileFilter = (req: any, file: any, cb: any) => {
    if (file.mimetype.startsWith('image')) {
        cb(null, true);
    } else {
        cb(new Error('Неверный тип файла, разрешены только изображения!'), false);
    }
};

export const upload = multer({ storage, fileFilter, limits: { fileSize: 1024 * 1024 * 10000 } }); // Лимит 5MB