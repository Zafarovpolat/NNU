const sqlite3 = require('sqlite3').verbose();
const config = require('../../config');

const db = new sqlite3.Database(config.DB_PATH);

// Инициализация таблиц
db.serialize(() => {
    // Пользователи
    db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      telegram_id INTEGER UNIQUE,
      full_name TEXT,
      state TEXT DEFAULT 'start',
      notifications_enabled INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
      FOREIGN KEY (course_id) REFERENCES courses(id)
    )
  `);

    // Покупки (убрал confirmed_at)
    db.run(`
    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      course_id INTEGER,
      payment_type TEXT, -- 'full', 'monthly', 'single'
      amount REAL,
      status TEXT DEFAULT 'pending', -- 'pending', 'waiting_confirmation', 'paid', 'rejected'
      expires_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (course_id) REFERENCES courses(id)
    )
  `);

    // Тестовые данные
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

            // Добавим тестовые уроки для первого курса
            const lessonStmt = db.prepare(`
        INSERT INTO lessons (course_id, title, video_url, order_num)
        VALUES (?, ?, ?, ?)
      `);

            lessonStmt.run(1, "Kirish: Nutq san'ati nima?", "https://example.com/lesson1.mp4", 1);
            lessonStmt.run(1, "Ovozni to'g'ri qo'yish", "https://example.com/lesson2.mp4", 2);
            lessonStmt.run(1, "Nafas olish texnikasi", "https://example.com/lesson3.mp4", 3);

            lessonStmt.finalize();
        }
    });
});

// Helper функции
const dbHelpers = {
    // Пользователи
    createUser: (telegramId, callback) => {
        db.run(
            'INSERT OR IGNORE INTO users (telegram_id) VALUES (?)',
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

    updateUserName: (telegramId, fullName, callback) => {
        db.run(
            'UPDATE users SET full_name = ?, state = "main_menu" WHERE telegram_id = ?',
            [fullName, telegramId],
            callback
        );
    },

    // Курсы
    getAllCourses: (type, callback) => {
        if (type) {
            db.all('SELECT * FROM courses WHERE type = ?', [type], callback);
        } else {
            db.all('SELECT * FROM courses', callback);
        }
    },

    getCourse: (id, callback) => {
        db.get('SELECT * FROM courses WHERE id = ?', [id], callback);
    },

    // Покупки
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

    getUserPurchases: (telegramId, callback) => {
        db.all(
            `SELECT p.*, c.title, c.type FROM purchases p
       JOIN courses c ON p.course_id = c.id
       WHERE p.user_id = (SELECT id FROM users WHERE telegram_id = ?)
       AND (p.status = 'paid' AND (p.expires_at IS NULL OR p.expires_at > datetime('now')))`,
            [telegramId],
            callback
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
    },

    // Уроки
    getLessonsByCourse: (courseId, callback) => {
        db.all(
            'SELECT * FROM lessons WHERE course_id = ? ORDER BY order_num',
            [courseId],
            callback
        );
    }
};

module.exports = { db, ...dbHelpers };