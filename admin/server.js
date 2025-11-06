const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const config = require('../config');
const db = require('../bot/database/db');

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Импортируем бота
let bot = null;

// Функция для получения экземпляра бота
function getBot() {
    if (!bot) {
        try {
            bot = require('../bot/bot');
            console.log('✅ Bot подключен к админке');
        } catch (error) {
            console.error('❌ Ошибка подключения бота:', error.message);
        }
    }
    return bot;
}

// API маршруты
app.get('/api/courses', (req, res) => {
    db.getAllCourses(null, (err, courses) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(courses);
    });
});

app.get('/api/purchases', (req, res) => {
    db.db.all(
        `SELECT p.*, u.full_name, u.telegram_id, c.title as course_title, c.type as course_type
     FROM purchases p
     JOIN users u ON p.user_id = u.id
     JOIN courses c ON p.course_id = c.id
     ORDER BY p.created_at DESC`,
        (err, purchases) => {
            if (err) {
                console.error('Ошибка получения покупок:', err);
                return res.status(500).json({ error: err.message });
            }
            res.json(purchases);
        }
    );
});

app.post('/api/purchases/:id/confirm', async (req, res) => {
    const { id } = req.params;

    console.log(`Подтверждение покупки #${id}`);

    try {
        // Получаем детали покупки
        db.getPurchaseWithDetails(id, async (err, purchase) => {
            if (err) {
                console.error('Ошибка получения покупки:', err);
                return res.status(500).json({ error: 'Ошибка получения покупки: ' + err.message });
            }

            if (!purchase) {
                console.error('Покупка не найдена:', id);
                return res.status(404).json({ error: 'Покупка не найдена' });
            }

            console.log('Покупка найдена:', purchase);

            // Подтверждаем оплату в БД
            db.confirmPayment(id, async (err) => {
                if (err) {
                    console.error('Ошибка подтверждения в БД:', err);
                    return res.status(500).json({ error: 'Ошибка подтверждения: ' + err.message });
                }

                console.log('Покупка подтверждена в БД');

                // Отправляем уведомление пользователю
                const telegramBot = getBot();

                if (!telegramBot) {
                    console.error('Бот не доступен');
                    return res.status(500).json({
                        error: 'Бот не доступен. Запустите сначала бота: npm run bot'
                    });
                }

                const icon = purchase.course_type === 'course' ? '📚' :
                    purchase.course_type === 'book' ? '📖' : '🎥';

                const message = `🎉 Tabriklaymiz!

✅ Sizning to'lovingiz tasdiqlandi!

${icon} Kurs: <b>${purchase.course_title}</b>
💰 Summa: ${purchase.amount.toLocaleString()} so'm

Kursni ko'rish uchun "🎓 Mening kurslarim" bo'limiga o'ting.

Omad tilaymiz! 🚀`;

                try {
                    await telegramBot.sendMessage(purchase.telegram_id, message, {
                        parse_mode: 'HTML',
                        reply_markup: {
                            keyboard: [
                                ['📚 Kurslar', '📖 Kitoblar'],
                                ['🎥 Video kurslar', '🎓 Mening kurslarim'],
                                ['⚙️ Sozlamalar']
                            ],
                            resize_keyboard: true
                        }
                    });

                    console.log(`✅ Уведомление отправлено пользователю ${purchase.telegram_id}`);

                    res.json({
                        success: true,
                        message: 'Оплата подтверждена, пользователю отправлено уведомление'
                    });
                } catch (sendError) {
                    console.error('Ошибка отправки сообщения:', sendError);

                    // Даже если не удалось отправить сообщение, оплата подтверждена
                    res.json({
                        success: true,
                        message: 'Оплата подтверждена, но не удалось отправить уведомление: ' + sendError.message,
                        warning: true
                    });
                }
            });
        });
    } catch (error) {
        console.error('Общая ошибка:', error);
        res.status(500).json({ error: 'Внутренняя ошибка: ' + error.message });
    }
});

app.post('/api/purchases/:id/reject', async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;

    console.log(`Отклонение покупки #${id}`);

    try {
        // Получаем детали покупки
        db.getPurchaseWithDetails(id, async (err, purchase) => {
            if (err || !purchase) {
                console.error('Ошибка получения покупки:', err);
                return res.status(500).json({ error: 'Покупка не найдена' });
            }

            console.log('Покупка найдена:', purchase);

            // Отклоняем оплату
            db.db.run(
                'UPDATE purchases SET status = "rejected" WHERE id = ?',
                [id],
                async (err) => {
                    if (err) {
                        console.error('Ошибка отклонения в БД:', err);
                        return res.status(500).json({ error: err.message });
                    }

                    console.log('Покупка отклонена в БД');

                    // Отправляем уведомление пользователю
                    const telegramBot = getBot();

                    if (!telegramBot) {
                        console.error('Бот не доступен');
                        return res.status(500).json({
                            error: 'Бот не доступен. Запустите сначала бота: npm run bot'
                        });
                    }

                    const message = `❌ To'lov rad etildi

📝 Buyurtma raqami: #${id}
📚 Kurs: ${purchase.course_title}
${reason ? `\n📋 Sabab: ${reason}` : ''}

Iltimos, to'lovni qaytadan amalga oshiring yoki qo'llab-quvvatlash xizmatiga murojaat qiling.`;

                    try {
                        await telegramBot.sendMessage(purchase.telegram_id, message, {
                            parse_mode: 'HTML'
                        });

                        console.log(`✅ Уведомление об отклонении отправлено пользователю ${purchase.telegram_id}`);

                        res.json({
                            success: true,
                            message: 'Оплата отклонена, пользователю отправлено уведомление'
                        });
                    } catch (sendError) {
                        console.error('Ошибка отправки сообщения:', sendError);

                        res.json({
                            success: true,
                            message: 'Оплата отклонена, но не удалось отправить уведомление: ' + sendError.message,
                            warning: true
                        });
                    }
                }
            );
        });
    } catch (error) {
        console.error('Общая ошибка:', error);
        res.status(500).json({ error: 'Внутренняя ошибка: ' + error.message });
    }
});

// Статистика
app.get('/api/stats', (req, res) => {
    const stats = {};

    db.db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
        stats.totalUsers = row ? row.count : 0;

        db.db.get('SELECT COUNT(*) as count FROM courses', (err, row) => {
            stats.totalCourses = row ? row.count : 0;

            db.db.get(
                'SELECT COUNT(*) as count FROM purchases WHERE status = "waiting_confirmation"',
                (err, row) => {
                    stats.pendingPayments = row ? row.count : 0;

                    db.db.get(
                        'SELECT COUNT(*) as count FROM purchases WHERE status = "paid"',
                        (err, row) => {
                            stats.confirmedPayments = row ? row.count : 0;

                            db.db.get(
                                'SELECT SUM(amount) as total FROM purchases WHERE status = "paid"',
                                (err, row) => {
                                    stats.totalRevenue = row && row.total ? row.total : 0;

                                    res.json(stats);
                                }
                            );
                        }
                    );
                }
            );
        });
    });
});

// Проверка статуса бота
app.get('/api/bot-status', (req, res) => {
    const telegramBot = getBot();
    res.json({
        connected: !!telegramBot,
        message: telegramBot ? 'Бот подключен' : 'Бот не подключен. Запустите: npm run bot'
    });
});

const server = app.listen(config.ADMIN_PORT, () => {
    console.log(`✅ Admin panel: http://localhost:${config.ADMIN_PORT}`);
    console.log(`⚠️  Убедитесь, что бот запущен: npm run bot`);
});

module.exports = app;