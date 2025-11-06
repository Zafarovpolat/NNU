const db = require('../database/db');
const menus = require('../keyboards/menus');

module.exports = (bot) => {
    // Обработка кнопки "Мои курсы"
    bot.on('message', (msg) => {
        if (!msg.text) return;

        const chatId = msg.chat.id;
        const telegramId = msg.from.id;
        const text = msg.text;

        if (text === '🎓 Mening kurslarim') {
            console.log('✅ Обработка: Мои курсы');

            db.getUserPurchases(telegramId, (err, purchases) => {
                if (err) {
                    console.error('Ошибка получения покупок:', err);
                    bot.sendMessage(chatId, 'Xatolik yuz berdi.');
                    return;
                }

                if (purchases.length === 0) {
                    bot.sendMessage(
                        chatId,
                        '❌ Sizda hali sotib olingan kurslar yo\'q.\n\nKurslarni ko\'rish uchun asosiy menyudan tanlang.'
                    );
                    return;
                }

                bot.sendMessage(
                    chatId,
                    '🎓 Sizning kurslaringiz:',
                    menus.myCoursesList(purchases)
                );
            });
        }

        // Обработка кнопки "Настройки"
        if (text === '⚙️ Sozlamalar') {
            console.log('✅ Обработка: Настройки');

            bot.sendMessage(
                chatId,
                '⚙️ Sozlamalar:',
                menus.settingsMenu
            );
        }
    });

    // Просмотр купленного курса
    bot.on('callback_query', (query) => {
        const chatId = query.message.chat.id;
        const data = query.data;

        if (data.startsWith('mycourse_')) {
            const courseId = parseInt(data.split('_')[1]);

            db.getCourse(courseId, (err, course) => {
                if (err || !course) {
                    bot.answerCallbackQuery(query.id, { text: 'Kurs topilmadi' });
                    return;
                }

                db.getLessonsByCourse(courseId, (err, lessons) => {
                    if (err) {
                        bot.answerCallbackQuery(query.id, { text: 'Xatolik yuz berdi' });
                        return;
                    }

                    if (lessons.length === 0) {
                        bot.answerCallbackQuery(query.id, {
                            text: 'Darslar hali yuklanmagan',
                            show_alert: true
                        });
                        return;
                    }

                    let message = `📚 ${course.title}\n\n`;

                    lessons.forEach((lesson, index) => {
                        message += `${index + 1}. ${lesson.title}\n`;
                    });

                    bot.sendMessage(chatId, message);

                    // Отправка видео
                    lessons.forEach(lesson => {
                        if (lesson.video_url) {
                            // Проверяем, это file_id или URL
                            if (lesson.video_url.startsWith('http')) {
                                bot.sendMessage(chatId, `🎥 ${lesson.title}\n${lesson.video_url}`);
                            } else {
                                bot.sendVideo(chatId, lesson.video_url, {
                                    caption: lesson.title
                                }).catch(err => {
                                    console.error('Ошибка отправки видео:', err);
                                    bot.sendMessage(chatId, `🎥 ${lesson.title}\n${lesson.video_url}`);
                                });
                            }
                        }
                    });

                    bot.answerCallbackQuery(query.id);
                });
            });
        }

        // Переключение уведомлений
        if (data === 'toggle_notifications') {
            const telegramId = query.from.id;

            db.getUser(telegramId, (err, user) => {
                if (err || !user) {
                    bot.answerCallbackQuery(query.id, { text: 'Xatolik yuz berdi' });
                    return;
                }

                const newState = user.notifications_enabled ? 0 : 1;

                db.db.run(
                    'UPDATE users SET notifications_enabled = ? WHERE telegram_id = ?',
                    [newState, telegramId],
                    (err) => {
                        if (err) {
                            bot.answerCallbackQuery(query.id, { text: 'Xatolik yuz berdi' });
                            return;
                        }

                        bot.answerCallbackQuery(query.id, {
                            text: newState ? '🔔 Bildirishnomalar yoqildi' : '🔕 Bildirishnomalar o\'chirildi',
                            show_alert: true
                        });
                    }
                );
            });
        }
    });
};