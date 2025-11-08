const bot = require('./bot');

console.log('🚀 Загрузка обработчиков бота...');

// Подключение обработчиков
require('./handlers/start')(bot);
require('./handlers/courses')(bot);
require('./handlers/payment')(bot);
require('./handlers/profile')(bot);

console.log('✅ Обработчики загружены');
console.log('✅ Bot ishga tushdi!');

// Логирование сообщений
bot.on('message', (msg) => {
    if (msg.text) {
        console.log(`📩 Сообщение от ${msg.from.id}: "${msg.text}"`);
    }
});

// ВАЖНО: Экспортируем
module.exports = bot;