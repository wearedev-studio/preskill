import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

// Обновляем интерфейс, добавляя необязательные поля
export interface IUser extends Document {
  username: string;
  email: string;
  password?: string;
  avatar: string;
  balance: number;
  passwordResetCode?: string; // Код для сброса пароля
  passwordResetExpires?: Date; // Время истечения кода
  comparePassword(enteredPassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>({
  // ... существующие поля (username, email, password, avatar, balance) ...
  username: { type: String, required: true, unique: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6, select: false },
  avatar: { type: String, default: 'default_avatar.png' },
  balance: { type: Number, default: 0 },

  // Добавляем новые поля в схему
  passwordResetCode: {
    type: String,
    select: false, // Также скрываем по умолчанию
  },
  passwordResetExpires: {
    type: Date,
    select: false, // И это тоже
  },
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