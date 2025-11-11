const sqlite3 = require('sqlite3').verbose();
const config = require('./config');

const db = new sqlite3.Database(config.DB_PATH);

console.log('🔍 Проверка БД:\n');

db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'", (err, row) => {
    if (row) {
        console.log('📋 Структура таблицы users:');
        console.log(row.sql);
        console.log('\n');
    }

    db.all('SELECT * FROM users', (err, users) => {
        if (err) {
            console.error('Ошибка:', err);
            return;
        }

        console.log(`👥 Найдено пользователей: ${users.length}\n`);

        users.forEach(u => {
            console.log('════════════════════════════════');
            console.log(`ID: ${u.id}`);
            console.log(`Telegram ID: ${u.telegram_id}`);
            console.log(`Username: "${u.username}" (тип: ${typeof u.username}, длина: ${u.username ? u.username.length : 0})`);
            console.log(`Имя: ${u.full_name}`);
            console.log(`Телефон: ${u.phone_number}`);
            console.log(`QR Token: ${u.qr_code_token}`);
            console.log(`Создан: ${u.created_at}`);
        });

        console.log('════════════════════════════════\n');
        db.close();
    });
});