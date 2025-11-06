const db = require('../database/db');
const menus = require('../keyboards/menus');
const config = require('../../config');
const path = require('path');
const fs = require('fs');

// Директория для чеков
const receiptsDir = path.join(__dirname, '../../uploads/receipts');
if (!fs.existsSync(receiptsDir)) {
    fs.mkdirSync(receiptsDir, { recursive: true });
}

module.exports = (bot) => {
    bot.on('callback_query', (query) => {
        const chatId = query.message.chat.id;
        const messageId = query.message.message_id;
        const data = query.data;
        const telegramId = query.from.id;

        // Выбор типа оплаты
        if (data.startsWith('buy_')) {
            const courseId = parseInt(data.split('_')[1]);

            // Проверяем, не купил ли уже пользователь этот курс
            db.checkUserHasCourse(telegramId, courseId, (err, hasCourse) => {
                if (err) {
                    bot.answerCallbackQuery(query.id, { text: 'Xatolik yuz berdi' });
                    return;
                }

                if (hasCourse) {
                    bot.answerCallbackQuery(query.id, {
                        text: 'Siz bu kursni allaqachon sotib olgansiz!',
                        show_alert: true
                    });
                    return;
                }

                db.getCourse(courseId, (err, course) => {
                    if (!course) {
                        bot.answerCallbackQuery(query.id, { text: 'Kurs topilmadi' });
                        return;
                    }

                    bot.editMessageText(
                        `💳 To'lov turini tanlang:\n\n${course.title}`,
                        {
                            chat_id: chatId,
                            message_id: messageId,
                            ...menus.paymentTypes(courseId, course)
                        }
                    );
                });
            });

            bot.answerCallbackQuery(query.id);
        }

        // Обработка выбора типа оплаты
        if (data.startsWith('pay_')) {
            const parts = data.split('_');
            const paymentType = parts[1];
            const courseId = parseInt(parts[2]);

            db.getCourse(courseId, (err, course) => {
                if (!course) {
                    bot.answerCallbackQuery(query.id, { text: 'Kurs topilmadi' });
                    return;
                }

                let amount;
                let typeText;

                switch (paymentType) {
                    case 'full':
                        amount = course.price_full;
                        typeText = "To'liq to'lov";
                        break;
                    case 'monthly':
                        amount = course.price_monthly;
                        typeText = "Oylik to'lov (30 kun)";
                        break;
                    case 'single':
                        amount = course.price_single;
                        typeText = "Bir martalik to'lov";
                        break;
                }

                db.createPurchase(telegramId, courseId, paymentType, amount, function (err) {
                    if (err) {
                        bot.answerCallbackQuery(query.id, { text: 'Xatolik yuz berdi' });
                        return;
                    }

                    const purchaseId = this.lastID;

                    const paymentInfo = `💳 <b>To'lov ma'lumotlari</b>\n\n` +
                        `📚 <b>Kurs:</b> ${course.title}\n` +
                        `💵 <b>Summa:</b> ${amount.toLocaleString()} so'm\n` +
                        `📋 <b>To'lov turi:</b> ${typeText}\n\n` +
                        `💳 <b>Karta raqami:</b>\n<code>${config.CARD_NUMBER}</code>\n` +
                        `👤 <b>Karta egasi:</b> ${config.CARD_HOLDER}\n\n` +
                        `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                        `⚠️ <b>To'lovni amalga oshirgandan so'ng:</b>\n` +
                        `📸 To'lov chekini surat, fayl yoki havola ko'rinishida yuboring\n\n` +
                        `📝 Buyurtma raqami: <b>#${purchaseId}</b>`;

                    bot.editMessageText(paymentInfo, {
                        chat_id: chatId,
                        message_id: messageId,
                        parse_mode: 'HTML'
                    });

                    // Устанавливаем состояние ожидания чека
                    db.updateUserState(telegramId, `waiting_receipt_${purchaseId}`);

                    bot.answerCallbackQuery(query.id, {
                        text: 'To\'lov ma\'lumotlari yuborildi',
                        show_alert: false
                    });
                });
            });
        }
    });

    // Обработка получения чека (фото, документ, ссылка)
    bot.on('message', (msg) => {
        const chatId = msg.chat.id;
        const telegramId = msg.from.id;

        db.getUser(telegramId, async (err, user) => {
            if (!user || !user.state) return;

            // Проверяем, ожидаем ли мы чек
            if (user.state.startsWith('waiting_receipt_')) {
                const purchaseId = parseInt(user.state.split('_')[2]);

                let proofPath = null;
                let proofType = null;

                try {
                    // Обработка фото
                    if (msg.photo && msg.photo.length > 0) {
                        const photo = msg.photo[msg.photo.length - 1]; // Берем самое большое фото
                        const fileId = photo.file_id;

                        const file = await bot.getFile(fileId);
                        const fileUrl = `https://api.telegram.org/file/bot${config.BOT_TOKEN}/${file.file_path}`;

                        proofPath = `receipt_${purchaseId}_${Date.now()}.jpg`;
                        proofType = 'photo';

                        // Скачиваем файл
                        const https = require('https');
                        const fileStream = fs.createWriteStream(path.join(receiptsDir, proofPath));

                        https.get(fileUrl, (response) => {
                            response.pipe(fileStream);
                            fileStream.on('finish', () => {
                                fileStream.close();
                                saveReceipt(purchaseId, proofPath, proofType, chatId, telegramId);
                            });
                        });

                        return;
                    }

                    // Обработка документа
                    if (msg.document) {
                        const fileId = msg.document.file_id;
                        const fileName = msg.document.file_name || 'receipt.pdf';

                        const file = await bot.getFile(fileId);
                        const fileUrl = `https://api.telegram.org/file/bot${config.BOT_TOKEN}/${file.file_path}`;

                        const ext = path.extname(fileName);
                        proofPath = `receipt_${purchaseId}_${Date.now()}${ext}`;
                        proofType = 'document';

                        const https = require('https');
                        const fileStream = fs.createWriteStream(path.join(receiptsDir, proofPath));

                        https.get(fileUrl, (response) => {
                            response.pipe(fileStream);
                            fileStream.on('finish', () => {
                                fileStream.close();
                                saveReceipt(purchaseId, proofPath, proofType, chatId, telegramId);
                            });
                        });

                        return;
                    }

                    // Обработка текста (ссылка)
                    if (msg.text && (msg.text.startsWith('http://') || msg.text.startsWith('https://'))) {
                        proofPath = msg.text;
                        proofType = 'link';

                        saveReceipt(purchaseId, proofPath, proofType, chatId, telegramId);
                        return;
                    }

                    // Если ничего не подошло
                    bot.sendMessage(
                        chatId,
                        '❌ Iltimos, to\'lov chekini surat, fayl yoki havola shaklida yuboring.'
                    );

                } catch (error) {
                    console.error('Ошибка обработки чека:', error);
                    bot.sendMessage(
                        chatId,
                        '❌ Xatolik yuz berdi. Qaytadan urinib ko\'ring.'
                    );
                }
            }
        });

        // Вспомогательная функция для сохранения чека
        function saveReceipt(purchaseId, proofPath, proofType, chatId, telegramId) {
            db.updatePurchaseProof(purchaseId, proofPath, proofType, (err) => {
                if (err) {
                    console.error('Ошибка сохранения чека:', err);
                    bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
                    return;
                }

                // Сбрасываем состояние
                db.updateUserState(telegramId, 'main_menu');

                // Отправляем подтверждение
                bot.sendMessage(
                    chatId,
                    `✅ <b>To'lov cheki qabul qilindi!</b>\n\n` +
                    `📝 Buyurtma raqami: <b>#${purchaseId}</b>\n\n` +
                    `⏳ Admin tekshirgandan so'ng sizga xabar beramiz.\n` +
                    `Odatda bu 1-2 soat ichida amalga oshiriladi.`,
                    {
                        parse_mode: 'HTML',
                        reply_markup: menus.mainMenu.reply_markup
                    }
                );

                // Логируем для админа
                console.log(`
═══════════════════════════════════
🔔 YANGI TO'LOV CHEKI!
═══════════════════════════════════
📝 ID: #${purchaseId}
👤 User: ${telegramId}
📎 Type: ${proofType}
📄 File: ${proofPath}
⏰ Time: ${new Date().toLocaleString('uz-UZ')}
═══════════════════════════════════
        `);
            });
        }
    });
};