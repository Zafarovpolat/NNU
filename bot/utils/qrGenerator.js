const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

// Базовый URL вашего сервера (измените на свой домен)
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Директория для QR-кодов
const QR_DIR = path.join(__dirname, '../../uploads/qr-codes');

// Создаем директорию если не существует
if (!fs.existsSync(QR_DIR)) {
    fs.mkdirSync(QR_DIR, { recursive: true });
}

/**
 * Генерация QR-кода для студента
 * @param {string} token - Уникальный токен студента
 * @param {number} telegramId - Telegram ID студента
 * @returns {Promise<string>} - Путь к файлу QR-кода
 */
async function generateStudentQR(token, telegramId) {
    try {
        const url = `${BASE_URL}/student/${token}`;
        const filename = `qr-${telegramId}.png`;
        const filepath = path.join(QR_DIR, filename);

        // Генерируем QR-код с настройками
        await QRCode.toFile(filepath, url, {
            errorCorrectionLevel: 'H',
            type: 'png',
            quality: 0.95,
            margin: 2,
            color: {
                dark: '#8b1538',  // Цвет QR (ваш primary цвет)
                light: '#FFFFFF'  // Белый фон
            },
            width: 500
        });

        console.log(`✅ QR-код создан: ${filename}`);
        return filepath;
    } catch (error) {
        console.error('❌ Ошибка генерации QR-кода:', error);
        throw error;
    }
}

/**
 * Получить путь к существующему QR-коду
 * @param {number} telegramId - Telegram ID студента
 * @returns {string|null} - Путь к файлу или null
 */
function getExistingQR(telegramId) {
    const filename = `qr-${telegramId}.png`;
    const filepath = path.join(QR_DIR, filename);

    if (fs.existsSync(filepath)) {
        return filepath;
    }

    return null;
}

module.exports = {
    generateStudentQR,
    getExistingQR
};