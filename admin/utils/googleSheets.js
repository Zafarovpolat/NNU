const { google } = require('googleapis');

// Настройки Google Sheets
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID || '';
const SHEET_NAME = 'QR Scans';

let CREDENTIALS = null;

if (process.env.GOOGLE_CREDENTIALS_BASE64) {
    try {
        const decoded = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString('utf-8');
        CREDENTIALS = JSON.parse(decoded);
        console.log('✅ CREDENTIALS загружены из base64');
    } catch (error) {
        console.error('❌ Ошибка декодирования base64:', error.message);
    }
}

let sheetsClient = null;
let isInitialized = false;

// ✅ ИСПРАВЛЕНО: Используем auth.fromJSON() - ПРАВИЛЬНЫЙ способ!
async function initGoogleSheets() {
    if (!CREDENTIALS) {
        console.log('⚠️ Google Sheets учетные данные не установлены');
        return false;
    }

    if (!SPREADSHEET_ID) {
        console.log('⚠️ GOOGLE_SHEET_ID не установлен');
        return false;
    }

    if (isInitialized) {
        return true;
    }

    try {
        console.log('🔑 Инициализация Google Sheets...');
        console.log('   Project ID:', CREDENTIALS.project_id);
        console.log('   Client Email:', CREDENTIALS.client_email);
        console.log('   Spreadsheet ID:', SPREADSHEET_ID);

        // ✅ ПРАВИЛЬНЫЙ способ - используем fromJSON
        const auth = new google.auth.GoogleAuth({
            credentials: CREDENTIALS,
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });

        const authClient = await auth.getClient();
        console.log('✅ Авторизация успешна');

        sheetsClient = google.sheets({ version: 'v4', auth: authClient });

        // Проверяем доступ к таблице
        const sheetInfo = await sheetsClient.spreadsheets.get({
            spreadsheetId: SPREADSHEET_ID
        });

        isInitialized = true;
        console.log('✅ Google Sheets подключен успешно');
        console.log('   Название таблицы:', sheetInfo.data.properties.title);
        return true;
    } catch (error) {
        console.error('❌ Ошибка подключения к Google Sheets:', error.message);

        if (error.message.includes('not found')) {
            console.error('   💡 Таблица не найдена. Проверьте GOOGLE_SHEET_ID');
        } else if (error.message.includes('permission') || error.message.includes('403')) {
            console.error('   💡 Нет доступа. Поделитесь таблицей с:', CREDENTIALS?.client_email);
        } else {
            console.error('   💡 Полная ошибка:', error);
        }

        return false;
    }
}

// Записать сканирование QR
async function logQRScan(user, timestamp) {
    if (!isInitialized) {
        console.log('⚠️ Google Sheets не инициализирован, пропускаем запись');
        return false;
    }

    try {
        const date = new Date(timestamp);

        // ✅ ИСПРАВЛЕНО: Простой и понятный формат
        const formattedDate = date.toLocaleString('ru-RU', {
            timeZone: 'Asia/Tashkent',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        }).replace(',', ''); // Убираем запятую между датой и временем

        // ✅ Безопасная обработка username
        let displayUsername = user.telegram_id.toString();
        if (user.username &&
            user.username !== '' &&
            user.username !== 'null' &&
            typeof user.username === 'string') {
            displayUsername = '@' + user.username;
        }

        // ✅ ИСПРАВЛЕНО: Добавляем + к телефону
        const phoneNumber = user.phone_number
            ? (user.phone_number.startsWith('+') ? user.phone_number : '+' + user.phone_number)
            : 'N/A';

        const values = [[
            formattedDate,           // 15.11.2025 22:30:45
            user.full_name || 'N/A',
            phoneNumber,             // +998999999999
            displayUsername,         // @username или ID
            user.telegram_id.toString()
        ]];

        await sheetsClient.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!A:E`,
            valueInputOption: 'RAW',  // ✅ RAW чтобы не конвертировать в число
            insertDataOption: 'INSERT_ROWS',
            resource: { values }
        });

        console.log('✅ Запись в Google Sheets:', user.full_name);
        return true;
    } catch (error) {
        console.error('❌ Ошибка записи в Google Sheets:', error.message);
        return false;
    }
}

module.exports = {
    initGoogleSheets,
    logQRScan
};