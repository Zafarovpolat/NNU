const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');

if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    console.log('✅ База данных удалена');
}

console.log('🔄 Пересоздание базы данных...');
require('./bot/database/db');

setTimeout(() => {
    console.log('✅ База данных создана заново!');
    process.exit(0);
}, 2000);