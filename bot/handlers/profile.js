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

                // Формируем список с информацией о сроке действия
                const purchasesWithExpiry = purchases.map(p => {
                    let expiryInfo = '';
                    if (p.days_left !== null) {
                        if (p.days_left > 0) {
                            expiryInfo = ` (${p.days_left} kun qoldi)`;
                        } else {
                            expiryInfo = ` (muddati tugagan)`;
                        }
                    }
                    return { ...p, expiryInfo };
                });

                bot.sendMessage(
                    chatId,
                    '🎓 Sizning kurslaringiz:',
                    menus.myCoursesList(purchasesWithExpiry)
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
        const telegramId = query.from.id;

        if (data.startsWith('mycourse_')) {
            const courseId = parseInt(data.split('_')[1]);

            db.getCourse(courseId, (err, course) => {
                if (err || !course) {
                    bot.answerCallbackQuery(query.id, { text: 'Kurs topilmadi' });
                    return;
                }

                const icon = course.type === 'course' ? '📚' :
                    course.type === 'book' ? '📖' : '🎥';

                // Для КНИГИ - отправляем только файл
                if (course.type === 'book') {
                    if (course.file_url) {
                        const message = `${icon} <b>${course.title}</b>\n\n` +
                            `📖 Kitobni yuklab olish:\n` +
                            `${course.file_url}`;

                        bot.sendMessage(chatId, message, {
                            parse_mode: 'HTML',
                            disable_web_page_preview: false
                        });
                    } else {
                        bot.answerCallbackQuery(query.id, {
                            text: 'Kitob fayli topilmadi',
                            show_alert: true
                        });
                    }
                    bot.answerCallbackQuery(query.id);
                    return;
                }

                // Для ОДНОРАЗОВОГО ВИДЕО
                if (course.type === 'video') {
                    if (course.file_url) {
                        const message = `${icon} <b>${course.title}</b>\n\n` +
                            `🎥 Video:\n` +
                            `${course.file_url}\n\n` +
                            `⏱ Davomiyligi: ${course.duration}`;

                        bot.sendMessage(chatId, message, {
                            parse_mode: 'HTML',
                            disable_web_page_preview: false
                        });
                    } else {
                        bot.answerCallbackQuery(query.id, {
                            text: 'Video topilmadi',
                            show_alert: true
                        });
                    }
                    bot.answerCallbackQuery(query.id);
                    return;
                }

                // Для КУРСА - отправляем список уроков
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

                    // Формируем одно сообщение со списком уроков
                    let message = `${icon} <b>${course.title}</b>\n\n`;
                    message += `📚 Darslar ro'yxati:\n\n`;

                    lessons.forEach((lesson, index) => {
                        message += `<b>${index + 1}-DARS:</b> `;
                        if (lesson.video_url) {
                            message += `<a href="${lesson.video_url}">${lesson.title}</a>\n`;
                        } else {
                            message += `${lesson.title}\n`;
                        }
                    });

                    message += `\n━━━━━━━━━━━━━━━━━━━━━━\n`;
                    message += `🎓 Jami darslar: ${lessons.length}\n`;
                    message += `⏱ Davomiyligi: ${course.duration}`;

                    bot.sendMessage(chatId, message, {
                        parse_mode: 'HTML',
                        disable_web_page_preview: true // Чтобы не загружались превью ссылок
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