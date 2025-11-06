const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const fs = require('fs');
const config = require('../config');
const db = require('../bot/database/db');

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Создаем директорию для загрузок
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

// JWT секрет
const JWT_SECRET = process.env.JWT_SECRET || 'najot-nur-secret-key-change-this';

// Middleware для проверки токена
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Токен не предоставлен' });
    }

    jwt.verify(token, JWT_SECRET, (err, admin) => {
        if (err) {
            return res.status(403).json({ error: 'Недействительный токен' });
        }
        req.admin = admin;
        next();
    });
};

// Статические файлы для загрузок
app.use('/uploads', express.static(uploadsDir));

// === АВТОРИЗАЦИЯ ===

// Login page
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/login.html'));
});

// Login API
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username и password обязательны' });
    }

    db.verifyAdmin(username, password, (err, admin) => {
        if (err) {
            console.error('Login error:', err);
            return res.status(500).json({ error: 'Ошибка сервера' });
        }

        if (!admin) {
            return res.status(401).json({ error: 'Неверный логин или пароль' });
        }

        // Создаем JWT токен
        const token = jwt.sign(
            { id: admin.id, username: admin.username },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            token,
            admin: {
                id: admin.id,
                username: admin.username,
                full_name: admin.full_name
            }
        });
    });
});

// Verify token
app.get('/api/auth/verify', authenticateToken, (req, res) => {
    res.json({ success: true, admin: req.admin });
});

// === АДМИНЫ ===

// Получить всех админов
app.get('/api/admins', authenticateToken, (req, res) => {
    db.getAllAdmins((err, admins) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(admins);
    });
});

// Создать нового админа
app.post('/api/admins', authenticateToken, (req, res) => {
    const { username, password, full_name } = req.body;

    if (!username || !password || !full_name) {
        return res.status(400).json({ error: 'Все поля обязательны' });
    }

    db.createAdmin(username, password, full_name, req.admin.id, function (err) {
        if (err) {
            if (err.message.includes('UNIQUE')) {
                return res.status(400).json({ error: 'Такой username уже существует' });
            }
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true, id: this.lastID });
    });
});

// Удалить админа
app.delete('/api/admins/:id', authenticateToken, (req, res) => {
    const { id } = req.params;

    if (parseInt(id) === req.admin.id) {
        return res.status(400).json({ error: 'Нельзя удалить самого себя' });
    }

    db.deleteAdmin(id, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// Изменить пароль
app.post('/api/admins/change-password', authenticateToken, (req, res) => {
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: 'Пароль должен быть не менее 6 символов' });
    }

    db.changePassword(req.admin.id, newPassword, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// === КУРСЫ ===

// Получить все курсы
app.get('/api/courses', (req, res) => {
    const { type } = req.query;
    db.getAllCourses(type, (err, courses) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(courses);
    });
});

// Получить курс по ID
app.get('/api/courses/:id', (req, res) => {
    db.getCourse(req.params.id, (err, course) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!course) return res.status(404).json({ error: 'Курс не найден' });
        res.json(course);
    });
});

// Создать курс
app.post('/api/courses', authenticateToken, upload.single('cover'), (req, res) => {
    const courseData = {
        title: req.body.title,
        description: req.body.description,
        type: req.body.type,
        lessons_count: parseInt(req.body.lessons_count) || 0,
        duration: req.body.duration,
        price_full: parseFloat(req.body.price_full) || 0,
        price_monthly: parseFloat(req.body.price_monthly) || 0,
        price_single: parseFloat(req.body.price_single) || 0,
        file_url: req.body.file_url || null
    };

    db.createCourse(courseData, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, id: this.lastID });
    });
});

// Обновить курс
app.put('/api/courses/:id', authenticateToken, (req, res) => {
    const courseData = {
        title: req.body.title,
        description: req.body.description,
        type: req.body.type,
        lessons_count: parseInt(req.body.lessons_count) || 0,
        duration: req.body.duration,
        price_full: parseFloat(req.body.price_full) || 0,
        price_monthly: parseFloat(req.body.price_monthly) || 0,
        price_single: parseFloat(req.body.price_single) || 0,
        file_url: req.body.file_url || null
    };

    db.updateCourse(req.params.id, courseData, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// Удалить курс
app.delete('/api/courses/:id', authenticateToken, (req, res) => {
    db.deleteCourse(req.params.id, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// === УРОКИ ===

// Получить уроки курса
app.get('/api/courses/:id/lessons', (req, res) => {
    db.getLessonsByCourse(req.params.id, (err, lessons) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(lessons);
    });
});

// Создать урок
app.post('/api/lessons', authenticateToken, (req, res) => {
    const { course_id, title, video_url, order_num } = req.body;

    db.createLesson(course_id, title, video_url, order_num, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, id: this.lastID });
    });
});

// Обновить урок
app.put('/api/lessons/:id', authenticateToken, (req, res) => {
    const { title, video_url, order_num } = req.body;

    db.updateLesson(req.params.id, title, video_url, order_num, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// Удалить урок
app.delete('/api/lessons/:id', authenticateToken, (req, res) => {
    db.deleteLesson(req.params.id, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// === ПОЛЬЗОВАТЕЛИ ===

app.get('/api/users', authenticateToken, (req, res) => {
    db.getAllUsers((err, users) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(users);
    });
});

// === ПОКУПКИ ===

app.get('/api/purchases', (req, res) => {
    db.db.all(
        `SELECT p.*, u.full_name, u.telegram_id, u.username, c.title as course_title, c.type as course_type
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

// Подтвердить оплату
app.post('/api/purchases/:id/confirm', authenticateToken, (req, res) => {
    const { id } = req.params;

    db.getPurchaseWithDetails(id, (err, purchase) => {
        if (err || !purchase) {
            return res.status(500).json({ error: 'Покупка не найдена' });
        }

        db.confirmPayment(id, (err) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            // Отправляем уведомление пользователю
            const bot = global.telegramBot;

            if (!bot) {
                return res.json({
                    success: true,
                    warning: true,
                    message: 'Бот не доступен для отправки уведомления'
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

            bot.sendMessage(purchase.telegram_id, message, {
                parse_mode: 'HTML',
                reply_markup: {
                    keyboard: [
                        ['📚 Kurslar', '📖 Kitoblar'],
                        ['🎥 Video kurslar', '🎓 Mening kurslarim'],
                        ['⚙️ Sozlamalar']
                    ],
                    resize_keyboard: true
                }
            }).then(() => {
                res.json({ success: true });
            }).catch(sendError => {
                console.error('Ошибка отправки уведомления:', sendError);
                res.json({
                    success: true,
                    warning: true,
                    message: 'Оплата подтверждена, но не удалось отправить уведомление'
                });
            });
        });
    });
});

// Отклонить оплату
app.post('/api/purchases/:id/reject', authenticateToken, (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;

    db.getPurchaseWithDetails(id, (err, purchase) => {
        if (err || !purchase) {
            return res.status(500).json({ error: 'Покупка не найдена' });
        }

        db.db.run(
            'UPDATE purchases SET status = "rejected" WHERE id = ?',
            [id],
            (err) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }

                const bot = global.telegramBot;

                if (!bot) {
                    return res.json({
                        success: true,
                        warning: true,
                        message: 'Бот не доступен'
                    });
                }

                const message = `❌ To'lov rad etildi

📝 Buyurtma raqami: #${id}
📚 Kurs: ${purchase.course_title}
${reason ? `\n📋 Sabab: ${reason}` : ''}

Iltimos, to'lovni qaytadan amalga oshiring yoki qo'llab-quvvatlash xizmatiga murojaat qiling.`;

                bot.sendMessage(purchase.telegram_id, message, {
                    parse_mode: 'HTML'
                }).then(() => {
                    res.json({ success: true });
                }).catch(sendError => {
                    res.json({
                        success: true,
                        warning: true,
                        message: 'Оплата отклонена, но не удалось отправить уведомление'
                    });
                });
            }
        );
    });
});

// === СТАТИСТИКА ===

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

// === ЗАГРУЗКА ФАЙЛОВ ===

app.post('/api/upload', authenticateToken, upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Файл не загружен' });
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ success: true, url: fileUrl, filename: req.file.filename });
});

// Проверка статуса бота
app.get('/api/bot-status', (req, res) => {
    const telegramBot = global.telegramBot;
    res.json({
        connected: !!telegramBot,
        message: telegramBot ? 'Бот подключен' : 'Бот не подключен'
    });
});

// Главная страница - редирект на login если не авторизован
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Запуск сервера
const server = app.listen(config.ADMIN_PORT, () => {
    console.log(`✅ Admin panel: http://localhost:${config.ADMIN_PORT}`);
    console.log(`📝 Default login: admin / admin123`);
    console.log(`⚠️  Измените пароль после первого входа!`);
});

module.exports = app;