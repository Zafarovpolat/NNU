if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

console.log('═══════════════════════════════════════');
console.log('🚀 Najot Nur Bot - Starting...');
console.log('═══════════════════════════════════════\n');

if (!process.env.BOT_TOKEN) {
    console.error('❌ BOT_TOKEN не найден!');
    process.exit(1);
}

console.log('✅ BOT_TOKEN найден');

try {
    console.log('\n🤖 Запуск Telegram бота...');
    const bot = require('./bot/index.js');

    // ВАЖНО: Устанавливаем глобально
    global.telegramBot = bot;
    console.log('✅ Бот установлен глобально');

    // Проверка через 2 секунды
    setTimeout(() => {
        if (global.telegramBot) {
            console.log('✅ Проверка: global.telegramBot доступен');
        } else {
            console.error('❌ Проверка: global.telegramBot НЕ доступен!');
        }
    }, 2000);

    // Запускаем админку через 3 секунды
    setTimeout(() => {
        console.log('\n💼 Запуск Admin Panel...');
        require('./admin/server.js');
    }, 3000);

    console.log('\n✅ Инициализация завершена!');
    console.log('═══════════════════════════════════════\n');

} catch (error) {
    console.error('\n❌ Ошибка запуска:', error);
    console.error(error.stack);
    process.exit(1);
}

process.on('SIGTERM', () => {
    console.log('\n👋 Остановка...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('\n👋 Остановка...');
    process.exit(0);
});