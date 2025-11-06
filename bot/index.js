const bot = require('./bot');

console.log('🚀 Загрузка обработчиков...');

// Подключение обработчиков в правильном порядке
require('./handlers/start')(bot);
require('./handlers/courses')(bot);
require('./handlers/payment')(bot);
require('./handlers/profile')(bot);

console.log('✅ Bot ishga tushdi!');

// Логирование всех сообщений для отладки
bot.on('message', (msg) => {
    if (msg.text) {
        console.log(`📩 Получено сообщение: "${msg.text}" от пользователя ${msg.from.id}`);
    }
});

// ВАЖНО: Экспортируем бота глобально для админки
global.telegramBot = bot;
console.log('✅ Бот экспортирован глобально');

module.exports = bot;