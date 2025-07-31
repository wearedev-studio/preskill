import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

// Интерфейс для загруженного документа
interface IKycDocument {
    documentType: 'PASSPORT' | 'UTILITY_BILL' | 'INTERNATIONAL_PASSPORT' | 'RESIDENCE_PERMIT';
    filePath: string;
    submittedAt: Date;
}

// Обновляем интерфейс, добавляя необязательные поля
export interface IUser extends Document {
  username: string;
  email: string;
  password?: string;
  avatar: string;
  balance: number;
  role: 'USER' | 'ADMIN';
  passwordResetCode?: string; // Код для сброса пароля
  passwordResetExpires?: Date; // Время истечения кода
  comparePassword(enteredPassword: string): Promise<boolean>;
  kycStatus: 'NOT_SUBMITTED' | 'PENDING' | 'APPROVED' | 'REJECTED';
  kycDocuments: IKycDocument[];
  kycRejectionReason?: string;
}

const kycDocumentSchema = new Schema<IKycDocument>({
    documentType: { type: String, required: true, enum: ['PASSPORT', 'UTILITY_BILL', 'INTERNATIONAL_PASSPORT', 'RESIDENCE_PERMIT'] },
    filePath: { type: String, required: true },
    submittedAt: { type: Date, default: Date.now },
}, { _id: false });

const userSchema = new Schema<IUser>({
  // ... существующие поля (username, email, password, avatar, balance) ...
  username: { type: String, required: true, unique: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6, select: false },
  avatar: { type: String, default: 'default_avatar.png' },
  balance: { type: Number, default: 0 },
  role: {
    type: String,
    enum: ['USER', 'ADMIN'],
    default: 'USER',
  },

  // Добавляем новые поля в схему
  passwordResetCode: {
    type: String,
    select: false, // Также скрываем по умолчанию
  },
  passwordResetExpires: {
    type: Date,
    select: false, // И это тоже
  },
  kycStatus: {
    type: String,
    enum: ['NOT_SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED'],
    default: 'NOT_SUBMITTED',
  },
  kycDocuments: [kycDocumentSchema],
  kycRejectionReason: { type: String },
}, {
  timestamps: true,
});

// ... существующие хуки и методы (pre 'save', comparePassword) остаются без изменений ...
userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = async function (enteredPassword: string): Promise<boolean> {
  if (!this.password) return false;
  return await bcrypt.compare(enteredPassword, this.password);
};


const User = mongoose.model<IUser>('User', userSchema);

export default User;