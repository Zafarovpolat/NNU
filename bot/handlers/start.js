const db = require('../database/db');
const menus = require('../keyboards/menus');

module.exports = (bot) => {
    // Команда /start
    bot.onText(/\/start/, (msg) => {
        const chatId = msg.chat.id;
        const telegramId = msg.from.id;

        console.log(`✅ /start от пользователя ${telegramId}`);

        db.createUser(telegramId, () => {
            db.getUser(telegramId, (err, user) => {
                if (user && user.full_name) {
                    bot.sendMessage(
                        chatId,
                        `Xush kelibsiz, ${user.full_name}! 👋`,
                        menus.mainMenu
                    );
                } else {
                    bot.sendMessage(
                        chatId,
                        `Assalomu alaykum! Najot Nurning\n"Nutq orqali insonlarga ta'sir o'tkazish" loyihasiga xush kelibsiz! 🎓\n\nIltimos, ismingizni yozing:`
                    );
                    db.updateUserState(telegramId, 'waiting_name');
                }
            });
        });
    });

    // Обработка ввода имени
    bot.on('text', (msg) => {
        const chatId = msg.chat.id;
        const telegramId = msg.from.id;
        const text = msg.text;
        const username = msg.from.username || '';

        // Пропускаем команды и кнопки меню
        if (!text || text.startsWith('/') || text.startsWith('📚') ||
            text.startsWith('📖') || text.startsWith('🎥') ||
            text.startsWith('🎓') || text.startsWith('⚙️')) {
            return;
        }

        db.getUser(telegramId, (err, user) => {
            if (user && user.state === 'waiting_name') {
                console.log(`✅ Сохранение имени: ${text}`);
                db.updateUserName(telegramId, text, username, () => {
                    bot.sendMessage(
                        chatId,
                        `Rahmat, ${text}! 😊\n\nEndi siz quyidagi bo'limlardan foydalanishingiz mumkin:`,
                        menus.mainMenu
                    );
                });
            }
        });
    });
};