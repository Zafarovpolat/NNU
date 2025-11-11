const db = require('./db');

function runMigrations() {
    console.log('🔄 Запуск миграций базы данных...');

    // Миграция 1: Добавление полей для QR-кодов
    db.db.run(`
    ALTER TABLE users ADD COLUMN phone_number TEXT;
  `, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error('Ошибка добавления phone_number:', err);
        }
    });

    db.db.run(`
    ALTER TABLE users ADD COLUMN qr_code_token TEXT UNIQUE;
  `, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error('Ошибка добавления qr_code_token:', err);
        }
    });

    db.db.run(`
    ALTER TABLE users ADD COLUMN qr_generated INTEGER DEFAULT 0;
  `, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error('Ошибка добавления qr_generated:', err);
        }
    });

    console.log('✅ Миграции завершены');
}

module.exports = { runMigrations };