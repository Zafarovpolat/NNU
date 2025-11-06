console.log('═══════════════════════════════════════');
console.log('🚀 Najot Nur Bot - Starting...');
console.log('═══════════════════════════════════════\n');

// Показываем ВСЕ переменные окружения (для отладки)
console.log('🔍 Отладка переменных окружения:');
console.log('   NODE_ENV:', process.env.NODE_ENV);
console.log('   RAILWAY_ENVIRONMENT:', process.env.RAILWAY_ENVIRONMENT);
console.log('   PORT:', process.env.PORT);
console.log('   BOT_TOKEN существует:', !!process.env.BOT_TOKEN);
console.log('   BOT_TOKEN длина:', process.env.BOT_TOKEN ? process.env.BOT_TOKEN.length : 0);

// Если на Railway
if (process.env.RAILWAY_ENVIRONMENT) {
    console.log('\n📦 Запуск на Railway');
    console.log('   Service ID:', process.env.RAILWAY_SERVICE_ID);
    console.log('   Deployment ID:', process.env.RAILWAY_DEPLOYMENT_ID);
}

console.log('\n');

// Проверка токена ПЕРЕД импортом
if (!process.env.BOT_TOKEN) {
    console.error('╔═══════════════════════════════════════════════════════╗');
    console.error('║  ❌ КРИТИЧЕСКАЯ ОШИБКА: BOT_TOKEN не найден!         ║');
    console.error('╚═══════════════════════════════════════════════════════╝\n');

    if (process.env.RAILWAY_ENVIRONMENT) {
        console.error('📝 Инструкция для Railway:');
        console.error('   1. Откройте: https://railway.app/dashboard');
        console.error('   2. Выберите проект: najot-nur-bot');
        console.error('   3. Variables → New Variable');
        console.error('   4. Name: BOT_TOKEN');
        console.error('   5. Value: ваш токен от @BotFather');
        console.error('   6. Сохраните и дождитесь редеплоя\n');
    }

    process.exit(1);
}

try {
    console.log('🤖 Запуск Telegram бота...');
    require('./bot/index.js');

    setTimeout(() => {
        console.log('\n💼 Запуск Admin Panel...');
        require('./admin/server.js');
    }, 2000);

    console.log('\n✅ Все сервисы запущены!');
    console.log('═══════════════════════════════════════\n');

} catch (error) {
    console.error('\n❌ Ошибка запуска:', error.message);
    console.error(error.stack);
    process.exit(1);
}

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('\n👋 SIGTERM - остановка...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('\n👋 SIGINT - остановка...');
    process.exit(0);
});