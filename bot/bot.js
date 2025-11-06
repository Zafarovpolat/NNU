const TelegramBot = require('node-telegram-bot-api');
const config = require('../config');

// Создаем экземпляр бота
const bot = new TelegramBot(config.BOT_TOKEN, { polling: true });

// Обработка ошибок
bot.on('polling_error', (error) => {
    console.error('Polling error:', error);
});

module.exports = bot;