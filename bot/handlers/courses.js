const db = require('../database/db');
const menus = require('../keyboards/menus');

module.exports = (bot) => {
    // Обработка текстовых кнопок меню
    bot.on('message', (msg) => {
        if (!msg.text) return;

        const chatId = msg.chat.id;
        const text = msg.text;

        console.log(`📚 Проверка кнопки: "${text}"`);

        // Кнопка "Курсы"
        if (text === '📚 Kurslar') {
            console.log('✅ Обработка: Курсы');
            db.getAllCourses('course', (err, courses) => {
                if (err) {
                    console.error('Ошибка получения курсов:', err);
                    bot.sendMessage(chatId, 'Xatolik yuz berdi.');
                    return;
                }

                if (courses.length === 0) {
                    bot.sendMessage(chatId, 'Hozircha kurslar mavjud emas.');
                    return;
                }

                bot.sendMessage(
                    chatId,
                    '📚 Mavjud kurslar:',
                    menus.coursesMenu(courses)
                );
            });
        }

        // Кнопка "Книги"
        if (text === '📖 Kitoblar') {
            console.log('✅ Обработка: Книги');
            db.getAllCourses('book', (err, courses) => {
                if (err) {
                    console.error('Ошибка получения книг:', err);
                    bot.sendMessage(chatId, 'Xatolik yuz berdi.');
                    return;
                }

                if (courses.length === 0) {
                    bot.sendMessage(chatId, 'Hozircha kitoblar mavjud emas.');
                    return;
                }

                bot.sendMessage(
                    chatId,
                    '📖 Mavjud kitoblar:',
                    menus.coursesMenu(courses)
                );
            });
        }

        // Кнопка "Видео курсы"
        if (text === '🎥 Video kurslar') {
            console.log('✅ Обработка: Видео курсы');
            db.getAllCourses('video', (err, courses) => {
                if (err) {
                    console.error('Ошибка получения видео:', err);
                    bot.sendMessage(chatId, 'Xatolik yuz berdi.');
                    return;
                }

                if (courses.length === 0) {
                    bot.sendMessage(chatId, 'Hozircha video kurslar mavjud emas.');
                    return;
                }

                bot.sendMessage(
                    chatId,
                    '🎥 Mavjud video kurslar:',
                    menus.coursesMenu(courses)
                );
            });
        }
    });

    // Детали курса
    bot.on('callback_query', (query) => {
        const chatId = query.message.chat.id;
        const messageId = query.message.message_id;
        const data = query.data;

        console.log(`🔘 Callback: ${data}`);

        if (data.startsWith('course_')) {
            const courseId = parseInt(data.split('_')[1]);

            db.getCourse(courseId, (err, course) => {
                if (!course) {
                    bot.answerCallbackQuery(query.id, { text: 'Kurs topilmadi' });
                    return;
                }

                const icon = course.type === 'course' ? '📚' : course.type === 'book' ? '📖' : '🎥';
                const details = `${icon} ${course.title}\n\n` +
                    `📝 ${course.description}\n\n` +
                    (course.lessons_count > 1 ? `🎓 Darslar soni: ${course.lessons_count}\n` : '') +
                    `⏱ Davomiyligi: ${course.duration}\n\n` +
                    `💰 Narxlar:\n` +
                    (course.price_full ? `   • To'liq: ${course.price_full.toLocaleString()} so'm\n` : '') +
                    (course.price_monthly ? `   • Oylik: ${course.price_monthly.toLocaleString()} so'm\n` : '') +
                    (course.price_single && course.type !== 'course' ? `   • Bir martalik: ${course.price_single.toLocaleString()} so'm` : '');

                bot.editMessageText(details, {
                    chat_id: chatId,
                    message_id: messageId,
                    ...menus.courseDetail(courseId)
                }).catch(err => {
                    console.error('Ошибка редактирования сообщения:', err);
                });
            });

            bot.answerCallbackQuery(query.id);
        }

        if (data === 'back_courses') {
            db.getAllCourses(null, (err, courses) => {
                bot.editMessageText('📚 Mavjud kurslar:', {
                    chat_id: chatId,
                    message_id: messageId,
                    ...menus.coursesMenu(courses)
                }).catch(err => {
                    console.error('Ошибка редактирования сообщения:', err);
                });
            });
            bot.answerCallbackQuery(query.id);
        }

        if (data === 'back_main') {
            bot.deleteMessage(chatId, messageId).catch(() => { });
            bot.sendMessage(chatId, 'Asosiy menyu:', menus.mainMenu);
            bot.answerCallbackQuery(query.id);
        }
    });
};