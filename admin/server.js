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

// Получить текущего админа
app.get('/api/auth/me', authenticateToken, (req, res) => {
    db.db.get(
        'SELECT id, username, full_name, created_at, last_login FROM admins WHERE id = ?',
        [req.admin.id],
        (err, admin) => {
            if (err || !admin) {
                return res.status(404).json({ error: 'Админ не найден' });
            }
            res.json({ admin });
        }
    );
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

// Обновить профиль
app.put('/api/admins/update-profile', authenticateToken, (req, res) => {
    const { username, full_name } = req.body;

    if (!username || !full_name) {
        return res.status(400).json({ error: 'Все поля обязательны' });
    }

    // Проверяем уникальность username
    db.db.get(
        'SELECT id FROM admins WHERE username = ? AND id != ?',
        [username, req.admin.id],
        (err, existing) => {
            if (existing) {
                return res.status(400).json({ error: 'Такой username уже существует' });
            }

            db.db.run(
                'UPDATE admins SET username = ?, full_name = ? WHERE id = ?',
                [username, full_name, req.admin.id],
                (err) => {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ success: true });
                }
            );
        }
    );
});

// Безопасная смена пароля (с проверкой текущего)
app.post('/api/admins/change-password-secure', authenticateToken, (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Все поля обязательны' });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ error: 'Новый пароль должен быть не менее 6 символов' });
    }

    // Проверяем текущий пароль
    db.db.get(
        'SELECT id FROM admins WHERE id = ? AND password_hash = ?',
        [req.admin.id, db.hashPassword(currentPassword)],
        (err, admin) => {
            if (!admin) {
                return res.status(401).json({ error: 'Неверный текущий пароль' });
            }

            db.changePassword(req.admin.id, newPassword, (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true });
            });
        }
    );
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
    console.log('📥 Запрос списка пользователей');

    db.getAllUsers((err, users) => {
        if (err) {
            console.error('Ошибка получения пользователей:', err);
            return res.status(500).json({ error: err.message });
        }

        console.log(`✅ Найдено пользователей: ${users ? users.length : 0}`);
        res.json(users || []);
    });
});

// === ПОКУПКИ ===

app.get('/api/purchases', (req, res) => {
    console.log('📥 Запрос списка покупок');

    db.db.all(
        `SELECT 
      p.*,
      u.full_name,
      u.telegram_id,
      COALESCE(u.username, '') as username,
      c.title as course_title,
      c.type as course_type
     FROM purchases p
     INNER JOIN users u ON p.user_id = u.id
     INNER JOIN courses c ON p.course_id = c.id
     ORDER BY p.created_at DESC`,
        (err, purchases) => {
            if (err) {
                console.error('❌ Ошибка SQL при получении покупок:', err);
                return res.status(500).json({
                    error: 'Database error: ' + err.message,
                    details: err.toString()
                });
            }

            console.log(`✅ Найдено покупок: ${purchases ? purchases.length : 0}`);
            res.json(purchases || []);
        }
    );
});

// Подтвердить оплату
app.post('/api/purchases/:id/confirm', authenticateToken, async (req, res) => {
    const { id } = req.params;

    console.log(`📝 Попытка подтвердить покупку #${id}`);

    db.getPurchaseWithDetails(id, async (err, purchase) => {
        if (err || !purchase) {
            console.error('Ошибка получения покупки:', err);
            return res.status(500).json({ error: 'Покупка не найдена' });
        }

        console.log('✅ Покупка найдена:', purchase);

        db.confirmPayment(id, async (err) => {
            if (err) {
                console.error('Ошибка подтверждения в БД:', err);
                return res.status(500).json({ error: err.message });
            }

            console.log('✅ Покупка подтверждена в БД');

            const bot = global.telegramBot;

            if (!bot) {
                console.error('❌ Бот не доступен глобально!');
                return res.json({
                    success: true,
                    warning: true,
                    message: 'Оплата подтверждена, но бот не доступен для отправки уведомления'
                });
            }

            console.log('✅ Бот найден, отправляем уведомление...');

            const icon = purchase.course_type === 'course' ? '📚' :
                purchase.course_type === 'book' ? '📖' : '🎥';

            const message = `🎉 <b>Tabriklaymiz!</b>

✅ Sizning to'lovingiz tasdiqlandi!

${icon} <b>Kurs:</b> ${purchase.course_title}
💰 <b>Summa:</b> ${purchase.amount.toLocaleString()} so'm

Kursni ko'rish uchun "🎓 Mening kurslarim" bo'limiga o'ting.

Omad tilaymiz! 🚀`;

            try {
                await bot.sendMessage(purchase.telegram_id, message, {
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
                    message: 'Оплата подтверждена и уведомление отправлено'
                });
            } catch (sendError) {
                console.error('❌ Ошибка отправки сообщения:', sendError);

                res.json({
                    success: true,
                    warning: true,
                    message: 'Оплата подтверждена, но не удалось отправить уведомление: ' + sendError.message
                });
            }
        });
    });
});

// Отклонить оплату
app.post('/api/purchases/:id/reject', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;

    console.log(`📝 Попытка отклонить покупку #${id}`);

    db.getPurchaseWithDetails(id, async (err, purchase) => {
        if (err || !purchase) {
            console.error('Ошибка получения покупки:', err);
            return res.status(500).json({ error: 'Покупка не найдена' });
        }

        console.log('✅ Покупка найдена:', purchase);

        db.db.run(
            'UPDATE purchases SET status = "rejected" WHERE id = ?',
            [id],
            async (err) => {
                if (err) {
                    console.error('Ошибка отклонения в БД:', err);
                    return res.status(500).json({ error: err.message });
                }

                console.log('✅ Покупка отклонена в БД');

                const bot = global.telegramBot;

                if (!bot) {
                    console.error('❌ Бот не доступен глобально!');
                    return res.json({
                        success: true,
                        warning: true,
                        message: 'Оплата отклонена, но бот не доступен'
                    });
                }

                console.log('✅ Бот найден, отправляем уведомление об отклонении...');

                const message = `❌ <b>To'lov rad etildi</b>

📝 Buyurtma raqami: #${id}
📚 Kurs: ${purchase.course_title}
${reason ? `\n📋 Sabab: ${reason}` : ''}

Iltimos, to'lovni qaytadan amalga oshiring yoki qo'llab-quvvatlash xizmatiga murojaat qiling.`;

                try {
                    await bot.sendMessage(purchase.telegram_id, message, {
                        parse_mode: 'HTML'
                    });

                    console.log(`✅ Уведомление об отклонении отправлено пользователю ${purchase.telegram_id}`);

                    res.json({
                        success: true,
                        message: 'Оплата отклонена и уведомление отправлено'
                    });
                } catch (sendError) {
                    console.error('❌ Ошибка отправки сообщения:', sendError);

                    res.json({
                        success: true,
                        warning: true,
                        message: 'Оплата отклонена, но не удалось отправить уведомление: ' + sendError.message
                    });
                }
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

// === РАССЫЛКА ===

// Настройка multer для broadcast фото
const uploadBroadcast = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            const broadcastDir = path.join(__dirname, '../uploads/broadcasts');
            if (!fs.existsSync(broadcastDir)) {
                fs.mkdirSync(broadcastDir, { recursive: true });
            }
            cb(null, broadcastDir);
        },
        filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, 'broadcast-' + uniqueSuffix + path.extname(file.originalname));
        }
    }),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Только изображения разрешены!'));
        }
    }
});

// Статистика для рассылки
app.get('/api/broadcast/stats', authenticateToken, (req, res) => {
    console.log('📊 Запрос статистики рассылки');

    db.db.get('SELECT COUNT(*) as total FROM users', (err, total) => {
        if (err) {
            console.error('Ошибка получения статистики:', err);
            return res.status(500).json({ error: err.message });
        }

        db.db.get(
            'SELECT COUNT(*) as enabled FROM users WHERE notifications_enabled = 1',
            (err, enabled) => {
                if (err) {
                    console.error('Ошибка получения статистики:', err);
                    return res.status(500).json({ error: err.message });
                }

                res.json({
                    totalUsers: total ? total.total : 0,
                    notificationsEnabled: enabled ? enabled.enabled : 0
                });
            }
        );
    });
});

// Тестовая рассылка (первому пользователю)
app.post('/api/broadcast/test', authenticateToken, uploadBroadcast.single('photo'), async (req, res) => {
    try {
        console.log('🧪 Тестовая рассылка');
        console.log('   Type:', req.body.type);
        console.log('   Message:', req.body.message);
        console.log('   File:', req.file ? req.file.filename : 'нет');

        const { message, type } = req.body;
        const bot = global.telegramBot;

        if (!bot) {
            if (req.file && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(500).json({ error: 'Бот не доступен. Запустите бота.' });
        }

        // Получаем первого пользователя для теста
        db.db.get('SELECT telegram_id, full_name FROM users LIMIT 1', async (err, user) => {
            if (err || !user) {
                console.error('Нет пользователей для теста');

                if (req.file && fs.existsSync(req.file.path)) {
                    fs.unlinkSync(req.file.path);
                }

                return res.status(400).json({ error: 'Нет пользователей в базе для тестовой отправки' });
            }

            const testUserId = user.telegram_id;

            try {
                if (type === 'photo' && req.file) {
                    console.log('📸 Отправка фото:', req.file.path);

                    await bot.sendPhoto(testUserId, req.file.path, {
                        caption: message || '',
                        parse_mode: 'HTML'
                    });
                } else {
                    if (!message) {
                        if (req.file && fs.existsSync(req.file.path)) {
                            fs.unlinkSync(req.file.path);
                        }
                        return res.status(400).json({ error: 'Сообщение пустое' });
                    }

                    console.log('📝 Отправка текста');

                    await bot.sendMessage(testUserId, message, {
                        parse_mode: 'HTML'
                    });
                }

                // Удаляем временный файл после успешной отправки
                if (req.file && fs.existsSync(req.file.path)) {
                    fs.unlinkSync(req.file.path);
                }

                console.log(`✅ Тест отправлен пользователю: ${user.full_name} (${testUserId})`);
                res.json({ success: true, message: `Тест отправлен: ${user.full_name}` });
            } catch (sendError) {
                console.error('❌ Ошибка отправки:', sendError);

                if (req.file && fs.existsSync(req.file.path)) {
                    fs.unlinkSync(req.file.path);
                }

                res.status(500).json({ error: sendError.message });
            }
        });
    } catch (error) {
        console.error('Test broadcast error:', error);

        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        res.status(500).json({ error: error.message });
    }
});

// Массовая рассылка
app.post('/api/broadcast/send', authenticateToken, uploadBroadcast.single('photo'), async (req, res) => {
    try {
        console.log('📢 Массовая рассылка');
        console.log('   Type:', req.body.type);
        console.log('   Message:', req.body.message);
        console.log('   File:', req.file ? req.file.filename : 'нет');

        const { message, type } = req.body;
        const bot = global.telegramBot;

        if (!bot) {
            if (req.file && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(500).json({ error: 'Бот не доступен. Запустите бота.' });
        }

        // Получаем всех пользователей
        db.db.all('SELECT telegram_id, full_name FROM users', async (err, users) => {
            if (err) {
                console.error('Ошибка получения пользователей:', err);

                if (req.file && fs.existsSync(req.file.path)) {
                    fs.unlinkSync(req.file.path);
                }

                return res.status(500).json({ error: err.message });
            }

            if (!users || users.length === 0) {
                if (req.file && fs.existsSync(req.file.path)) {
                    fs.unlinkSync(req.file.path);
                }

                return res.json({
                    success: true,
                    total: 0,
                    sent: 0,
                    failed: 0,
                    message: 'Нет пользователей для рассылки'
                });
            }

            console.log(`📢 Начало рассылки для ${users.length} пользователей`);

            // Отправляем ответ сразу
            res.json({ success: true, total: users.length });

            let sent = 0;
            let failed = 0;

            // Отправляем в фоне
            for (const user of users) {
                try {
                    if (type === 'photo' && req.file) {
                        await bot.sendPhoto(user.telegram_id, req.file.path, {
                            caption: message || '',
                            parse_mode: 'HTML'
                        });
                    } else if (message) {
                        await bot.sendMessage(user.telegram_id, message, {
                            parse_mode: 'HTML',
                            disable_web_page_preview: true
                        });
                    }

                    sent++;
                    console.log(`✅ Отправлено: ${user.full_name} (${user.telegram_id})`);

                    // Задержка чтобы не превысить лимит Telegram (30 сообщений в секунду)
                    await new Promise(resolve => setTimeout(resolve, 50));
                } catch (error) {
                    failed++;
                    console.error(`❌ Ошибка отправки ${user.telegram_id}:`, error.message);
                }
            }

            // Удаляем файл после рассылки
            if (req.file && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }

            console.log(`📊 Рассылка завершена. Успешно: ${sent}, Ошибок: ${failed}`);
        });
    } catch (error) {
        console.error('Broadcast error:', error);

        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        res.status(500).json({ error: error.message });
    }
});

// === ПРОЧЕЕ ===

// Проверка статуса бота
app.get('/api/bot-status', (req, res) => {
    const telegramBot = global.telegramBot;
    res.json({
        connected: !!telegramBot,
        message: telegramBot ? 'Бот подключен' : 'Бот не подключен'
    });
});

// Главная страница
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