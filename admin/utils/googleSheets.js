const { google } = require('googleapis');

// Настройки Google Sheets
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID || '';
const SHEET_NAME = 'QR Scans';

// ✅ ИСПРАВЛЕНО: Поддержка base64
let CREDENTIALS = null;

if (process.env.GOOGLE_CREDENTIALS_BASE64) {
    try {
        const decoded = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString('utf-8');
        CREDENTIALS = JSON.parse(decoded);
        console.log('✅ CREDENTIALS загружены из base64');
    } catch (error) {
        console.error('❌ Ошибка декодирования GOOGLE_CREDENTIALS_BASE64:', error.message);
    }
} else if (process.env.GOOGLE_CREDENTIALS) {
    try {
        CREDENTIALS = typeof process.env.GOOGLE_CREDENTIALS === 'string'
            ? JSON.parse(process.env.GOOGLE_CREDENTIALS)
            : process.env.GOOGLE_CREDENTIALS;
        console.log('✅ CREDENTIALS загружены из JSON');
    } catch (error) {
        console.error('❌ Ошибка парсинга GOOGLE_CREDENTIALS:', error.message);
    }
}

let sheetsClient = null;
let isInitialized = false;

// Инициализация
async function initGoogleSheets() {
    if (!CREDENTIALS) {
        console.log('⚠️ Google Sheets учетные данные не установлены');
        console.log('   Установите GOOGLE_CREDENTIALS_BASE64 или GOOGLE_CREDENTIALS');
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

        const auth = new google.auth.GoogleAuth({
            credentials: CREDENTIALS,
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });

        const authClient = await auth.getClient();
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

        if (error.message.includes('DECODER')) {
            console.error('   💡 Проблема с форматом private_key');
            console.error('   💡 Используйте GOOGLE_CREDENTIALS_BASE64 вместо GOOGLE_CREDENTIALS');
        } else if (error.message.includes('not found')) {
            console.error('   💡 Таблица не найдена. Проверьте GOOGLE_SHEET_ID');
        } else if (error.message.includes('permission')) {
            console.error('   💡 Нет доступа. Поделитесь таблицей с:', CREDENTIALS?.client_email);
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
        const formattedDate = date.toLocaleString('ru-RU', {
            timeZone: 'Asia/Tashkent',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        const values = [[
            formattedDate,
            user.full_name || 'N/A',
            user.phone_number || 'N/A',
            user.username ? '@' + user.username : user.telegram_id.toString(),
            user.telegram_id.toString()
        ]];

        await sheetsClient.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!A:E`,
            valueInputOption: 'USER_ENTERED',
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