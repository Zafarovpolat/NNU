const db = require('../database/db');
const menus = require('../keyboards/menus');

module.exports = (bot) => {
    // Команда /start
    bot.onText(/\/start/, (msg) => {
        const chatId = msg.chat.id;
        const telegramId = msg.from.id;
        const username = msg.from.username || '';

        console.log(`✅ /start от пользователя ${telegramId} (@${username})`);

        // Сначала создаем пользователя
        db.createUser(telegramId, (err) => {
            if (err) {
                console.error('Ошибка создания пользователя:', err);
            }

            // Затем получаем его данные
            db.getUser(telegramId, (err, user) => {
                if (err) {
                    console.error('Ошибка получения пользователя:', err);
                    return;
                }

                if (user && user.full_name) {
                    // Пользователь уже зарегистрирован
                    console.log(`👤 Существующий пользователь: ${user.full_name}`);
                    bot.sendMessage(
                        chatId,
                        `Xush kelibsiz, ${user.full_name}! 👋`,
                        menus.mainMenu
                    );
                } else {
                    // Новый пользователь - запрашиваем имя
                    console.log(`👤 Новый пользователь: ${telegramId}`);
                    bot.sendMessage(
                        chatId,
                        `Assalomu alaykum! Najot Nurning\n"Nutq orqali insonlarga ta'sir o'tkazish" loyihasiga xush kelibsiz! 🎓\n\nIltimos, to'liq ismingizni yozing:`
                    );
                    db.updateUserState(telegramId, 'waiting_name', (err) => {
                        if (err) console.error('Ошибка обновления состояния:', err);
                    });
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
            if (err) {
                console.error('Ошибка получения пользователя:', err);
                return;
            }

            if (user && user.state === 'waiting_name') {
                console.log(`✅ Сохранение имени для ${telegramId}: ${text}`);

                db.updateUserName(telegramId, text, username, (err) => {
                    if (err) {
                        console.error('Ошибка сохранения имени:', err);
                        bot.sendMessage(chatId, 'Xatolik yuz berdi. Qaytadan urinib ko\'ring.');
                        return;
                    }

                    console.log(`✅ Имя сохранено успешно: ${text}`);

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