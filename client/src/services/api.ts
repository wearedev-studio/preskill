import axios from 'axios';
const apiClient = axios.create({ baseURL: 'http://localhost:5001/api' });

// --- KYC ---
/**
 * Отправляет документы KYC на проверку
 */
export const submitKycDocument = (formData: FormData) => {
    // --- ИСПРАВЛЕНИЕ ЗДЕСЬ ---
    // 1. Вручную достаем токен из хранилища
    const token = localStorage.getItem('token');

    // 2. Создаем заголовки и принудительно добавляем Authorization
    const config = {
        headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${token}`
        }
    };

    // 3. Отправляем запрос с нашей новой конфигурацией
    return apiClient.post('/users/kyc', formData, config);
};

export default apiClient;