const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const config = require('../../config');

const db = new sqlite3.Database(config.DB_PATH);

// Хеширование пароля
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

// Инициализация таблиц
db.serialize(() => {
    // Пользователи
    db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      telegram_id INTEGER UNIQUE,
      full_name TEXT,
      username TEXT,
      phone_number TEXT,
      qr_code_token TEXT UNIQUE,
      qr_generated INTEGER DEFAULT 0,
      state TEXT DEFAULT 'start',
      notifications_enabled INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

    // Миграция: добавление новых полей если их нет
    db.all("PRAGMA table_info(users)", (err, columns) => {
        if (err) {
            console.error('Ошибка получения структуры таблицы:', err);
            return;
        }

        const columnNames = columns.map(c => c.name);

        // 1. Добавляем phone_number
        if (!columnNames.includes('phone_number')) {
            db.run('ALTER TABLE users ADD COLUMN phone_number TEXT', (err) => {
                if (err && !err.message.includes('duplicate')) {
                    console.error('Ошибка добавления phone_number:', err);
                } else {
                    console.log('✅ Добавлено поле phone_number');
                }
            });
        }

        // 2. Добавляем qr_code_token БЕЗ UNIQUE (SQLite ограничение)
        if (!columnNames.includes('qr_code_token')) {
            db.run('ALTER TABLE users ADD COLUMN qr_code_token TEXT', (err) => {
                if (err && !err.message.includes('duplicate')) {
                    console.error('Ошибка добавления qr_code_token:', err);
                } else {
                    console.log('✅ Добавлено поле qr_code_token');

                    // Создаем уникальный индекс вместо UNIQUE constraint
                    db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_qr_token ON users(qr_code_token)', (err) => {
                        if (err) {
                            console.error('Ошибка создания индекса:', err);
                        } else {
                            console.log('✅ Создан уникальный индекс для qr_code_token');
                        }
                    });
                }
            });
        }

        // 3. Добавляем qr_generated
        if (!columnNames.includes('qr_generated')) {
            db.run('ALTER TABLE users ADD COLUMN qr_generated INTEGER DEFAULT 0', (err) => {
                if (err && !err.message.includes('duplicate')) {
                    console.error('Ошибка добавления qr_generated:', err);
                } else {
                    console.log('✅ Добавлено поле qr_generated');
                }
            });
        }
    });

    // Админы
    db.run(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password_hash TEXT,
      full_name TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME,
      FOREIGN KEY (created_by) REFERENCES admins(id)
    )
  `);

    // Курсы
    db.run(`
    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      description TEXT,
      type TEXT, -- 'course', 'book', 'video'
      lessons_count INTEGER,
      duration TEXT,
      price_full REAL,
      price_monthly REAL,
      price_single REAL,
      file_url TEXT, -- для книг и одноразовых видео
      cover_image TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

    // Уроки/Контент
    db.run(`
    CREATE TABLE IF NOT EXISTS lessons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER,
      title TEXT,
      video_url TEXT,
      order_num INTEGER,
      duration TEXT,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
    )
  `);

    // Покупки
    db.run(`
    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      course_id INTEGER,
      payment_type TEXT,
      amount REAL,
      status TEXT DEFAULT 'pending',
      payment_proof TEXT, -- путь к файлу чека
      payment_proof_type TEXT, -- photo, document, link
      expires_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (course_id) REFERENCES courses(id)
    )
  `);

    // Создаем суперадмина если его нет
    db.get("SELECT COUNT(*) as count FROM admins", (err, row) => {
        if (row && row.count === 0) {
            const defaultPassword = 'admin123'; // ИЗМЕНИТЕ ЭТО!
            db.run(
                'INSERT INTO admins (username, password_hash, full_name) VALUES (?, ?, ?)',
                ['admin', hashPassword(defaultPassword), 'Super Admin'],
                () => {
                    console.log('✅ Создан суперадмин:');
                    console.log('   Username: admin');
                    console.log('   Password:', defaultPassword);
                    console.log('   ⚠️  ИЗМЕНИТЕ ПАРОЛЬ ПОСЛЕ ПЕРВОГО ВХОДА!');
                }
            );
        }
    });

    // Тестовые данные для курсов
    db.get("SELECT COUNT(*) as count FROM courses", (err, row) => {
        if (row && row.count === 0) {
            const stmt = db.prepare(`
        INSERT INTO courses (title, description, type, lessons_count, duration, price_full, price_monthly, price_single)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

            stmt.run("Nutq san'ati asoslari", "To'liq nutq san'ati kursi", "course", 12, "3 oy", 500000, 200000, 50000);
            stmt.run("Jamoat oldida so'zlash", "Jamoat oldida ishonch bilan so'zlash", "course", 8, "2 oy", 350000, 150000, 45000);
            stmt.run("Nutq san'ati kitobi", "Amaliy qo'llanma", "book", 1, "Bir martalik", 100000, 0, 100000);
            stmt.run("Ovoz bilan ishlash", "Ovozni qanday to'g'ri qo'yish", "video", 1, "45 daqiqa", 75000, 0, 75000);

            stmt.finalize();
        }
    });
});

// Helper функции
const dbHelpers = {
    // === АДМИНЫ ===
    createAdmin: (username, password, fullName, createdBy, callback) => {
        db.run(
            'INSERT INTO admins (username, password_hash, full_name, created_by) VALUES (?, ?, ?, ?)',
            [username, hashPassword(password), fullName, createdBy],
            callback
        );
    },

    verifyAdmin: (username, password, callback) => {
        db.get(
            'SELECT * FROM admins WHERE username = ? AND password_hash = ?',
            [username, hashPassword(password)],
            (err, admin) => {
                if (admin) {
                    db.run('UPDATE admins SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [admin.id]);
                }
                callback(err, admin);
            }
        );
    },

    getAllAdmins: (callback) => {
        db.all('SELECT id, username, full_name, created_at, last_login FROM admins', callback);
    },

    deleteAdmin: (id, callback) => {
        db.run('DELETE FROM admins WHERE id = ? AND id != 1', [id], callback);
    },

    changePassword: (adminId, newPassword, callback) => {
        db.run(
            'UPDATE admins SET password_hash = ? WHERE id = ?',
            [hashPassword(newPassword), adminId],
            callback
        );
    },

    updateAdmin: (id, username, fullName, callback) => {
        db.run(
            'UPDATE admins SET username = ?, full_name = ? WHERE id = ?',
            [username, fullName, id],
            callback
        );
    },

    // === ПОЛЬЗОВАТЕЛИ ===
    createUser: (telegramId, username, fullName, callback) => {
        db.run(
            'INSERT OR IGNORE INTO users (telegram_id, username, full_name) VALUES (?, ?, ?)',
            [telegramId, username, fullName],
            callback
        );
    },

    getUserByTelegramId: (telegramId, callback) => {
        db.get(
            'SELECT * FROM users WHERE telegram_id = ?',
            [telegramId],
            callback
        );
    },

    getUser: (telegramId, callback) => {
        db.get(
            'SELECT * FROM users WHERE telegram_id = ?',
            [telegramId],
            callback
        );
    },

    updateUserState: (telegramId, state, callback) => {
        db.run(
            'UPDATE users SET state = ? WHERE telegram_id = ?',
            [state, telegramId],
            callback
        );
    },

    updateUserName: (telegramId, fullName, username, callback) => {
        db.run(
            'UPDATE users SET full_name = ?, username = ?, state = "main_menu" WHERE telegram_id = ?',
            [fullName, username, telegramId],
            callback
        );
    },

    updateUserPhone: (telegramId, phoneNumber, callback) => {
        db.run(
            'UPDATE users SET phone_number = ? WHERE telegram_id = ?',
            [phoneNumber, telegramId],
            callback
        );
    },

    getAllUsers: (callback) => {
        db.all(
            `SELECT u.*, 
        COUNT(DISTINCT p.id) as purchases_count,
        SUM(CASE WHEN p.status = 'paid' THEN p.amount ELSE 0 END) as total_spent
       FROM users u
       LEFT JOIN purchases p ON u.id = p.user_id
       GROUP BY u.id
       ORDER BY u.created_at DESC`,
            callback
        );
    },

    // === QR-КОДЫ ===
    generateQRToken: (telegramId, callback) => {
        const token = uuidv4();

        db.run(
            'UPDATE users SET qr_code_token = ?, qr_generated = 1 WHERE telegram_id = ?',
            [token, telegramId],
            function (err) {
                if (err) return callback(err);
                callback(null, token);
            }
        );
    },

    getUserByQRToken: (token, callback) => {
        db.get(
            `SELECT 
        u.*,
        COUNT(DISTINCT p.id) as courses_count,
        SUM(CASE WHEN p.status = 'paid' THEN p.amount ELSE 0 END) as total_spent
      FROM users u
      LEFT JOIN purchases p ON u.id = p.user_id
      WHERE u.qr_code_token = ?
      GROUP BY u.id`,
            [token],
            callback
        );
    },

    // === КУРСЫ ===
    getAllCourses: (type, callback) => {
        if (type) {
            db.all('SELECT * FROM courses WHERE type = ? ORDER BY created_at DESC', [type], callback);
        } else {
            db.all('SELECT * FROM courses ORDER BY created_at DESC', callback);
        }
    },

    getCourse: (id, callback) => {
        db.get('SELECT * FROM courses WHERE id = ?', [id], callback);
    },

    createCourse: (courseData, callback) => {
        const { title, description, type, lessons_count, duration, price_full, price_monthly, price_single, file_url } = courseData;
        db.run(
            `INSERT INTO courses (title, description, type, lessons_count, duration, price_full, price_monthly, price_single, file_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [title, description, type, lessons_count, duration, price_full, price_monthly, price_single, file_url],
            callback
        );
    },

    updateCourse: (id, courseData, callback) => {
        const { title, description, type, lessons_count, duration, price_full, price_monthly, price_single, file_url } = courseData;
        db.run(
            `UPDATE courses SET 
        title = ?, description = ?, type = ?, lessons_count = ?, 
        duration = ?, price_full = ?, price_monthly = ?, price_single = ?, 
        file_url = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
            [title, description, type, lessons_count, duration, price_full, price_monthly, price_single, file_url, id],
            callback
        );
    },

    deleteCourse: (id, callback) => {
        db.run('DELETE FROM courses WHERE id = ?', [id], callback);
    },

    // === УРОКИ ===
    getLessonsByCourse: (courseId, callback) => {
        db.all(
            'SELECT * FROM lessons WHERE course_id = ? ORDER BY order_num',
            [courseId],
            callback
        );
    },

    createLesson: (courseId, title, videoUrl, orderNum, callback) => {
        db.run(
            'INSERT INTO lessons (course_id, title, video_url, order_num) VALUES (?, ?, ?, ?)',
            [courseId, title, videoUrl, orderNum],
            callback
        );
    },

    updateLesson: (id, title, videoUrl, orderNum, callback) => {
        db.run(
            'UPDATE lessons SET title = ?, video_url = ?, order_num = ? WHERE id = ?',
            [title, videoUrl, orderNum, id],
            callback
        );
    },

    deleteLesson: (id, callback) => {
        db.run('DELETE FROM lessons WHERE id = ?', [id], callback);
    },

    // === ПОКУПКИ ===
    createPurchase: (userId, courseId, paymentType, amount, callback) => {
        const expiresAt = paymentType === 'monthly'
            ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            : null;

        db.run(
            `INSERT INTO purchases (user_id, course_id, payment_type, amount, expires_at)
       VALUES ((SELECT id FROM users WHERE telegram_id = ?), ?, ?, ?, ?)`,
            [userId, courseId, paymentType, amount, expiresAt],
            callback
        );
    },

    updatePurchaseProof: (purchaseId, proofPath, proofType, callback) => {
        db.run(
            `UPDATE purchases SET 
        payment_proof = ?, 
        payment_proof_type = ?, 
        status = 'waiting_confirmation',
        updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
            [proofPath, proofType, purchaseId],
            callback
        );
    },

    getUserPurchases: (telegramId, callback) => {
        db.all(
            `SELECT p.*, c.title, c.type, c.file_url,
        CASE 
          WHEN p.expires_at IS NOT NULL 
          THEN CAST((julianday(p.expires_at) - julianday('now')) AS INTEGER)
          ELSE NULL 
        END as days_left
       FROM purchases p
       JOIN courses c ON p.course_id = c.id
       WHERE p.user_id = (SELECT id FROM users WHERE telegram_id = ?)
       AND p.status = 'paid' 
       AND (p.expires_at IS NULL OR p.expires_at > datetime('now'))
       ORDER BY p.created_at DESC`,
            [telegramId],
            callback
        );
    },

    checkUserHasCourse: (telegramId, courseId, callback) => {
        db.get(
            `SELECT COUNT(*) as count FROM purchases p
       JOIN users u ON p.user_id = u.id
       WHERE u.telegram_id = ? 
       AND p.course_id = ?
       AND p.status = 'paid'
       AND (p.expires_at IS NULL OR p.expires_at > datetime('now'))`,
            [telegramId, courseId],
            (err, row) => {
                callback(err, row ? row.count > 0 : false);
            }
        );
    },

    confirmPayment: (purchaseId, callback) => {
        db.run(
            'UPDATE purchases SET status = "paid", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [purchaseId],
            callback
        );
    },

    getPurchaseWithDetails: (purchaseId, callback) => {
        db.get(
            `SELECT p.*, c.title as course_title, c.type as course_type, u.telegram_id, u.full_name
       FROM purchases p
       JOIN courses c ON p.course_id = c.id
       JOIN users u ON p.user_id = u.id
       WHERE p.id = ?`,
            [purchaseId],
            callback
        );
    }
};

module.exports = { db, hashPassword, ...dbHelpers };