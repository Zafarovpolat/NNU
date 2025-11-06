console.log('═══════════════════════════════════════');
console.log('🚀 Najot Nur Bot - Starting...');
console.log('═══════════════════════════════════════\n');

console.log('🔍 Отладка переменных окружения:');
console.log('   NODE_ENV:', process.env.NODE_ENV);
console.log('   RAILWAY_ENVIRONMENT:', process.env.RAILWAY_ENVIRONMENT);
console.log('   PORT:', process.env.PORT);
console.log('   BOT_TOKEN существует:', !!process.env.BOT_TOKEN);
console.log('   BOT_TOKEN длина:', process.env.BOT_TOKEN ? process.env.BOT_TOKEN.length : 0);

if (process.env.RAILWAY_ENVIRONMENT) {
    console.log('\n📦 Запуск на Railway');
    console.log('   Service ID:', process.env.RAILWAY_SERVICE_ID);
}

console.log('\n');

if (!process.env.BOT_TOKEN) {
    console.error('╔═══════════════════════════════════════════════════════╗');
    console.error('║  ❌ КРИТИЧЕСКАЯ ОШИБКА: BOT_TOKEN не найден!         ║');
    console.error('╚═══════════════════════════════════════════════════════╝\n');
    process.exit(1);
}

try {
    console.log('🤖 Запуск Telegram бота...');
    const bot = require('./bot/index.js');

    setTimeout(() => {
        console.log('\n💼 Запуск Admin Panel...');
        require('./admin/server.js');

        // Проверяем что бот доступен глобально
        setTimeout(() => {
            if (global.telegramBot) {
                console.log('✅ Бот доступен для админки');
            } else {
                console.warn('⚠️  Бот НЕ доступен глобально!');
            }
        }, 1000);
    }, 3000); // Увеличиваем до 3 секунд

    console.log('\n✅ Все сервисы запущены!');
    console.log('═══════════════════════════════════════\n');

} catch (error) {
    console.error('\n❌ Ошибка запуска:', error.message);
    console.error(error.stack);
    process.exit(1);
}

process.on('SIGTERM', () => {
    console.log('\n👋 SIGTERM - остановка...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('\n👋 SIGINT - остановка...');
    process.exit(0);
});