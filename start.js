const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Запуск Najot Nur Bot...\n');

// Запуск бота
const bot = spawn('node', ['bot/index.js'], {
    stdio: 'inherit',
    cwd: __dirname
});

// Ждем 2 секунды перед запуском админки
setTimeout(() => {
    console.log('\n🚀 Запуск Admin Panel...\n');

    // Запуск админки
    const admin = spawn('node', ['admin/server.js'], {
        stdio: 'inherit',
        cwd: __dirname
    });

    admin.on('error', (error) => {
        console.error('❌ Ошибка запуска админки:', error);
    });
}, 2000);

bot.on('error', (error) => {
    console.error('❌ Ошибка запуска бота:', error);
});

// Обработка завершения
process.on('SIGINT', () => {
    console.log('\n\n👋 Остановка серверов...');
    process.exit();
});