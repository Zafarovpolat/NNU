const db = require('../database/db');
const menus = require('../keyboards/menus');
const config = require('../../config');

module.exports = (bot) => {
    bot.on('callback_query', (query) => {
        const chatId = query.message.chat.id;
        const messageId = query.message.message_id;
        const data = query.data;
        const telegramId = query.from.id;

        // Выбор типа оплаты
        if (data.startsWith('buy_')) {
            const courseId = parseInt(data.split('_')[1]);

            db.getCourse(courseId, (err, course) => {
                bot.editMessageText(
                    `💳 To'lov turini tanlang:\n\n${course.title}`,
                    {
                        chat_id: chatId,
                        message_id: messageId,
                        ...menus.paymentTypes(courseId, course)
                    }
                );
            });

            bot.answerCallbackQuery(query.id);
        }

        // Обработка выбора типа оплаты
        if (data.startsWith('pay_')) {
            const parts = data.split('_');
            const paymentType = parts[1];
            const courseId = parseInt(parts[2]);

            db.getCourse(courseId, (err, course) => {
                let amount;
                let typeText;

                switch (paymentType) {
                    case 'full':
                        amount = course.price_full;
                        typeText = "To'liq to'lov";
                        break;
                    case 'monthly':
                        amount = course.price_monthly;
                        typeText = "Oylik to'lov";
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

                    const paymentInfo = `💳 To'lov ma'lumotlari\n\n` +
                        `📚 Kurs: ${course.title}\n` +
                        `💵 Summa: ${amount.toLocaleString()} so'm\n` +
                        `📋 To'lov turi: ${typeText}\n\n` +
                        `💳 Karta raqami:\n<code>${config.CARD_NUMBER}</code>\n` +
                        `👤 Karta egasi: ${config.CARD_HOLDER}\n\n` +
                        `⚠️ To'lovni amalga oshirgandan so'ng, "To'lovni tasdiqlash" tugmasini bosing.\n` +
                        `Admin tekshirgandan so'ng kursga kirish huquqi beriladi.`;

                    bot.editMessageText(paymentInfo, {
                        chat_id: chatId,
                        message_id: messageId,
                        parse_mode: 'HTML',
                        ...menus.confirmPayment(purchaseId)
                    });
                });
            });

            bot.answerCallbackQuery(query.id);
        }

        // Подтверждение оплаты пользователем
        if (data.startsWith('confirm_')) {
            const purchaseId = parseInt(data.split('_')[1]);

            db.db.get(
                `SELECT p.*, c.title as course_title, u.full_name, u.telegram_id 
         FROM purchases p
         JOIN courses c ON p.course_id = c.id
         JOIN users u ON p.user_id = u.id
         WHERE p.id = ?`,
                [purchaseId],
                (err, purchase) => {
                    if (err || !purchase) {
                        bot.answerCallbackQuery(query.id, { text: 'Xatolik yuz berdi' });
                        return;
                    }

                    db.db.run(
                        'UPDATE purchases SET status = ? WHERE id = ?',
                        ['waiting_confirmation', purchaseId],
                        (err) => {
                            if (err) {
                                bot.answerCallbackQuery(query.id, { text: 'Xatolik yuz berdi' });
                                return;
                            }

                            bot.editMessageText(
                                `✅ To'lov haqida ma'lumot yuborildi!\n\n` +
                                `Admin tekshirgandan so'ng sizga xabar beramiz.\n` +
                                `Odatda bu 1-2 soat ichida amalga oshiriladi.\n\n` +
                                `📝 Buyurtma raqami: #${purchaseId}`,
                                {
                                    chat_id: chatId,
                                    message_id: messageId
                                }
                            );

                            console.log(`
═══════════════════════════════════
🔔 YANGI TO'LOV BUYURTMASI!
═══════════════════════════════════
📝 ID: #${purchaseId}
👤 Foydalanuvchi: ${purchase.full_name || 'N/A'}
📱 Telegram ID: ${purchase.telegram_id}
📚 Kurs: ${purchase.course_title}
💰 Summa: ${purchase.amount.toLocaleString()} so'm
📋 Turi: ${purchase.payment_type}
⏰ Vaqt: ${new Date().toLocaleString('uz-UZ')}
═══════════════════════════════════
              `);

                            bot.answerCallbackQuery(query.id, {
                                text: 'Ma\'lumot yuborildi! Admin tez orada tekshiradi.',
                                show_alert: true
                            });
                        }
                    );
                }
            );
        }
    });
};