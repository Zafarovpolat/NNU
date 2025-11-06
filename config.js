// На Railway переменные окружения инжектятся автоматически
// dotenv нужен только для локальной разработки
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

// Логируем для отладки (БЕЗ показа токена)
console.log('\n🔧 Загрузка конфигурации...');
console.log('   Environment:', process.env.NODE_ENV || 'development');
console.log('   Railway:', process.env.RAILWAY_ENVIRONMENT ? 'YES ✓' : 'NO');

// Проверяем BOT_TOKEN
if (!process.env.BOT_TOKEN) {
    console.error('\n❌ КРИТИЧЕСКАЯ ОШИБКА: BOT_TOKEN не найден!');
    console.error('\n📋 Доступные переменные окружения:');
    console.error(Object.keys(process.env).filter(key =>
        !key.includes('PATH') &&
        !key.includes('SECRET') &&
        !key.includes('KEY') &&
        !key.includes('TOKEN')
    ).join(', '));
    console.error('\n💡 Решение для Railway:');
    console.error('   1. Откройте Railway Dashboard');
    console.error('   2. Выберите ваш проект');
    console.error('   3. Variables → New Variable');
    console.error('   4. Добавьте: BOT_TOKEN=ваш_токен');
    console.error('   5. Нажмите Deploy\n');
    process.exit(1);
}

const config = {
    BOT_TOKEN: process.env.BOT_TOKEN,
    ADMIN_PORT: parseInt(process.env.PORT || process.env.ADMIN_PORT || '3000'),
    CARD_NUMBER: process.env.CARD_NUMBER || '8600000000000000',
    CARD_HOLDER: process.env.CARD_HOLDER || 'NAJOT NUR',
    DB_PATH: process.env.DB_PATH || './database.db'
};

// Проверка конфигурации
console.log('✅ Конфигурация:');
console.log('   BOT_TOKEN:', config.BOT_TOKEN ? `***${config.BOT_TOKEN.slice(-4)}` : '❌ НЕ НАЙДЕН');
console.log('   ADMIN_PORT:', config.ADMIN_PORT);
console.log('   CARD_NUMBER:', config.CARD_NUMBER);
console.log('   DB_PATH:', config.DB_PATH);
console.log('');

module.exports = config;