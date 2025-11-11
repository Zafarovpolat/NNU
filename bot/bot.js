const TelegramBot = require('node-telegram-bot-api');
const config = require('../config');
const db = require('./database/db');
const { generateStudentQR, getExistingQR } = require('./utils/qrGenerator');

// Создаем экземпляр бота
const bot = new TelegramBot(config.BOT_TOKEN, { polling: true });

// Сохраняем бота глобально для доступа из admin panel
global.telegramBot = bot;

// Обработка ошибок
bot.on('polling_error', (error) => {
    console.error('❌ Polling error:', error.code, error.message);
});

// Состояния регистрации
const userStates = new Map();

// ========================================
// МЕНЮ
// ========================================

const mainMenu = {
    reply_markup: {
        keyboard: [
            ['📚 Kurslar', '📖 Kitoblar'],
            ['🎥 Video kurslar', '🎓 Mening kurslarim'],
            ['🎫 Mening QR kodim', '⚙️ Sozlamalar']
        ],
        resize_keyboard: true
    }
};

// ========================================
// КОМАНДЫ
// ========================================

bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;

    // ✅ ИСПРАВЛЕНО: Правильно получаем username
    const username = msg.from.username ? String(msg.from.username) : '';

    console.log(`📱 /start от пользователя: ${telegramId}, username: ${username}`);

    db.getUserByTelegramId(telegramId, async (err, user) => {
        if (err) {
            console.error('Ошибка БД:', err);
            return bot.sendMessage(chatId, '❌ Xatolik yuz berdi. Qaytadan urinib ko\'ring.');
        }

        if (user) {
            // Пользователь уже зарегистрирован
            bot.sendMessage(
                chatId,
                `👋 Xush kelibsiz, ${user.full_name}!\n\n` +
                `📚 Kurslar, kitoblar va video kurslarni ko'rish uchun menyudan tanlang.\n` +
                `🎫 QR kodingizni olish uchun "Mening QR kodim" tugmasini bosing.`,
                mainMenu
            );
        } else {
            // Новый пользователь - начинаем регистрацию
            userStates.set(telegramId, { step: 'waiting_full_name' });

            bot.sendMessage(
                chatId,
                `👋 <b>Xush kelibsiz Najot Nur platformasiga!</b>\n\n` +
                `Ro'yxatdan o'tish uchun quyidagi ma'lumotlarni kiriting.\n\n` +
                `📝 <b>To'liq ismingizni kiriting:</b>\n` +
                `<i>Masalan: Aliyev Vali Akramovich</i>`,
                { parse_mode: 'HTML' }
            );
        }
    });
});
// ========================================
// РЕГИСТРАЦИЯ
// ========================================

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const text = msg.text;

    // Пропускаем команды и кнопки меню
    if (text && (text.startsWith('/') || text.includes('📚') || text.includes('📖') || text.includes('🎥') || text.includes('🎓') || text.includes('🎫') || text.includes('⚙️'))) {
        return;
    }

    const state = userStates.get(telegramId);

    if (!state) return;

    // Шаг 1: Получение ФИО
    if (state.step === 'waiting_full_name') {
        if (!text || text.length < 3) {
            return bot.sendMessage(chatId, '❌ Iltimos, to\'liq ismingizni kiriting (kamida 3 ta harf).');
        }

        state.full_name = text;
        state.step = 'waiting_phone';
        userStates.set(telegramId, state);

        bot.sendMessage(
            chatId,
            `✅ Ism: <b>${text}</b>\n\n` +
            `📱 <b>Telefon raqamingizni kiriting:</b>\n` +
            `<i>Masalan: +998901234567 yoki 901234567</i>`,
            {
                parse_mode: 'HTML',
                reply_markup: {
                    keyboard: [
                        [{
                            text: '📱 Telefon raqamni yuborish',
                            request_contact: true
                        }]
                    ],
                    resize_keyboard: true,
                    one_time_keyboard: true
                }
            }
        );
        return;
    }

    // Шаг 2: Получение телефона
    if (state.step === 'waiting_phone') {
        let phoneNumber = null;

        // Если отправлен контакт
        if (msg.contact) {
            phoneNumber = msg.contact.phone_number;
        }
        // Если введен вручную
        else if (text) {
            // Очищаем номер от лишних символов
            phoneNumber = text.replace(/[^\d+]/g, '');

            // Добавляем + если его нет
            if (!phoneNumber.startsWith('+')) {
                phoneNumber = '+998' + phoneNumber.replace(/^998/, '');
            }

            // Проверка формата
            if (!/^\+998\d{9}$/.test(phoneNumber)) {
                return bot.sendMessage(
                    chatId,
                    '❌ Noto\'g\'ri format!\n\n' +
                    'Telefon raqamni to\'g\'ri formatda kiriting:\n' +
                    '+998901234567 yoki 901234567'
                );
            }
        } else {
            return bot.sendMessage(chatId, '❌ Iltimos, telefon raqamingizni yuboring.');
        }

        // ✅ ИСПРАВЛЕНО: Правильно получаем username
        const username = msg.from.username ? String(msg.from.username) : '';

        db.createUser(
            telegramId,
            username, // ✅ Теперь это строка, а не объект
            state.full_name,
            (err) => {
                if (err) {
                    console.error('Ошибка создания пользователя:', err);
                    userStates.delete(telegramId);
                    return bot.sendMessage(chatId, '❌ Xatolik yuz berdi. Qaytadan /start bosing.');
                }

                // Обновляем телефон
                db.updateUserPhone(telegramId, phoneNumber, (err) => {
                    if (err) {
                        console.error('Ошибка обновления телефона:', err);
                    }

                    userStates.delete(telegramId);

                    bot.sendMessage(
                        chatId,
                        `✅ <b>Ro'yxatdan o'tish muvaffaqiyatli!</b>\n\n` +
                        `👤 Ism: ${state.full_name}\n` +
                        `📱 Telefon: ${phoneNumber}\n\n` +
                        `📚 Endi siz kurslarni ko'rishingiz va sotib olishingiz mumkin.\n` +
                        `🎫 QR kodingizni olish uchun "Mening QR kodim" tugmasini bosing.`,
                        {
                            parse_mode: 'HTML',
                            ...mainMenu
                        }
                    );
                });
            }
        );
        return;
    }
});

// ========================================
// QR-КОД
// ========================================

bot.onText(/🎫 Mening QR kodim/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;

    console.log(`📱 Запрос QR-кода от: ${telegramId}`);

    db.getUserByTelegramId(telegramId, async (err, user) => {
        if (err || !user) {
            return bot.sendMessage(chatId, '❌ Foydalanuvchi topilmadi. /start bosing.');
        }

        if (user.qr_generated && user.qr_code_token) {
            const qrPath = getExistingQR(telegramId);

            if (qrPath) {
                // ✅ ИСПРАВЛЕНО: Используем Railway URL
                const baseUrl = process.env.BASE_URL || 'https://web-production-c55f0.up.railway.app';

                await bot.sendPhoto(chatId, qrPath, {
                    caption:
                        `🎫 <b>Sizning QR kodingiz</b>\n\n` +
                        `👤 ${user.full_name}\n` +
                        `📱 ${user.phone_number || 'Telefon kiritilmagan'}\n\n` +
                        `Bu QR kodni skanerlash orqali sizning ma'lumotlaringizni ko'rish mumkin.`,
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🌐 Veb-sahifada ko\'rish', url: `${baseUrl}/student/${user.qr_code_token}` }]
                        ]
                    }
                });
            } else {
                bot.sendMessage(chatId, '❌ QR kod fayli topilmadi. Qaytadan yarating.');
            }
        } else {
            bot.sendMessage(
                chatId,
                `🎫 <b>QR kod yaratish</b>\n\n` +
                `Sizning shaxsiy QR kodingiz hali yaratilmagan.\n\n` +
                `QR kod orqali:\n` +
                `✅ Sizning ma'lumotlaringizni ko'rish mumkin\n` +
                `✅ Kurslaringiz haqida ma'lumot olish mumkin\n` +
                `✅ Ishonchli identifikatsiya\n\n` +
                `⚠️ QR kodni bir marta yaratish mumkin.`,
                {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '✨ QR kod yaratish', callback_data: 'generate_qr' }],
                            [{ text: '❌ Bekor qilish', callback_data: 'cancel' }]
                        ]
                    }
                }
            );
        }
    });
});

// Callback для генерации QR
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const telegramId = query.from.id;
    const data = query.data;

    if (data === 'generate_qr') {
        await bot.answerCallbackQuery(query.id, { text: 'QR kod yaratilmoqda...' });

        db.getUserByTelegramId(telegramId, async (err, user) => {
            if (err || !user) {
                return bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
            }

            if (user.qr_generated) {
                return bot.sendMessage(chatId, '⚠️ QR kod allaqachon yaratilgan!');
            }

            db.generateQRToken(telegramId, async (err, token) => {
                if (err) {
                    console.error('Ошибка генерации токена:', err);
                    return bot.sendMessage(chatId, '❌ Xatolik yuz berdi. Qaytadan urinib ko\'ring.');
                }

                try {
                    const qrPath = await generateStudentQR(token, telegramId);

                    // ✅ ИСПРАВЛЕНО: Используем Railway URL
                    const baseUrl = process.env.BASE_URL || 'https://web-production-c55f0.up.railway.app';

                    await bot.sendPhoto(chatId, qrPath, {
                        caption:
                            `✅ <b>QR kod muvaffaqiyatli yaratildi!</b>\n\n` +
                            `👤 ${user.full_name}\n` +
                            `📱 ${user.phone_number || 'Telefon kiritilmagan'}\n\n` +
                            `Bu QR kodni saqlang va kerak bo'lganda ko'rsating.`,
                        parse_mode: 'HTML',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '🌐 Veb-sahifada ko\'rish', url: `${baseUrl}/student/${token}` }]
                            ]
                        }
                    });

                    console.log(`✅ QR-код отправлен пользователю: ${telegramId}`);
                } catch (error) {
                    console.error('Ошибка создания QR:', error);
                    bot.sendMessage(chatId, '❌ QR kod yaratishda xatolik yuz berdi.');
                }
            });
        });
    } else if (data === 'cancel') {
        await bot.answerCallbackQuery(query.id);
        bot.deleteMessage(chatId, query.message.message_id);
    }
});

// ========================================
// КУРСЫ И ПОКУПКИ (базовая структура)
// ========================================

bot.onText(/📚 Kurslar/, async (msg) => {
    const chatId = msg.chat.id;

    db.getAllCourses('course', (err, courses) => {
        if (err || !courses || courses.length === 0) {
            return bot.sendMessage(chatId, '❌ Kurslar topilmadi.');
        }

        let message = '📚 <b>Mavjud kurslar:</b>\n\n';

        courses.forEach((c, i) => {
            message += `${i + 1}. <b>${c.title}</b>\n`;
            message += `   📝 ${c.description}\n`;
            message += `   📊 Darslar: ${c.lessons_count} ta\n`;
            message += `   ⏱ Davomiyligi: ${c.duration}\n`;
            message += `   💰 Narx: ${c.price_full.toLocaleString()} so'm\n\n`;
        });

        bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
    });
});

bot.onText(/📖 Kitoblar/, async (msg) => {
    const chatId = msg.chat.id;

    db.getAllCourses('book', (err, books) => {
        if (err || !books || books.length === 0) {
            return bot.sendMessage(chatId, '❌ Kitoblar topilmadi.');
        }

        let message = '📖 <b>Mavjud kitoblar:</b>\n\n';

        books.forEach((b, i) => {
            message += `${i + 1}. <b>${b.title}</b>\n`;
            message += `   📝 ${b.description}\n`;
            message += `   💰 Narx: ${b.price_single.toLocaleString()} so'm\n\n`;
        });

        bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
    });
});

bot.onText(/🎥 Video kurslar/, async (msg) => {
    const chatId = msg.chat.id;

    db.getAllCourses('video', (err, videos) => {
        if (err || !videos || videos.length === 0) {
            return bot.sendMessage(chatId, '❌ Video kurslar topilmadi.');
        }

        let message = '🎥 <b>Mavjud video kurslar:</b>\n\n';

        videos.forEach((v, i) => {
            message += `${i + 1}. <b>${v.title}</b>\n`;
            message += `   📝 ${v.description}\n`;
            message += `   ⏱ Davomiyligi: ${v.duration}\n`;
            message += `   💰 Narx: ${v.price_single.toLocaleString()} so'm\n\n`;
        });

        bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
    });
});

bot.onText(/🎓 Mening kurslarim/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;

    db.getUserPurchases(telegramId, (err, purchases) => {
        if (err || !purchases || purchases.length === 0) {
            return bot.sendMessage(chatId, '❌ Sizda hali sotib olingan kurslar yo\'q.');
        }

        let message = '🎓 <b>Sizning kurslaringiz:</b>\n\n';

        purchases.forEach((p, i) => {
            const icon = p.type === 'course' ? '📚' : p.type === 'book' ? '📖' : '🎥';
            message += `${i + 1}. ${icon} <b>${p.title}</b>\n`;

            if (p.days_left !== null) {
                message += `   ⏳ Qolgan vaqt: ${p.days_left} kun\n`;
            }

            message += `\n`;
        });

        bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
    });
});

bot.onText(/⚙️ Sozlamalar/, async (msg) => {
    const chatId = msg.chat.id;

    bot.sendMessage(
        chatId,
        '⚙️ <b>Sozlamalar</b>\n\n' +
        'Bu bo\'limda sozlamalarni boshqarish mumkin.',
        { parse_mode: 'HTML' }
    );
});

console.log('✅ Bot ishga tushdi');

module.exports = bot;