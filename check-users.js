const db = require('./bot/database/db');

console.log('🔍 Проверка пользователей в базе данных...\n');

db.db.all('SELECT * FROM users ORDER BY created_at DESC', (err, users) => {
    if (err) {
        console.error('❌ Ошибка:', err);
        process.exit(1);
    }

    console.log(`📊 Всего пользователей в БД: ${users.length}\n`);

    if (users.length === 0) {
        console.log('⚠️  База данных пуста. Пользователи еще не регистрировались.\n');
    } else {
        console.log('┌─────┬──────────────┬─────────────────┬────────────────┬──────────┐');
        console.log('│ ID  │ Telegram ID  │ Full Name       │ Username       │ State    │');
        console.log('├─────┼──────────────┼─────────────────┼────────────────┼──────────┤');

        users.forEach(u => {
            console.log(
                '│',
                String(u.id).padEnd(3),
                '│',
                String(u.telegram_id || '').padEnd(12),
                '│',
                String(u.full_name || 'N/A').padEnd(15).substring(0, 15),
                '│',
                String(u.username || '-').padEnd(14).substring(0, 14),
                '│',
                String(u.state || '').padEnd(8),
                '│'
            );
        });

        console.log('└─────┴──────────────┴─────────────────┴────────────────┴──────────┘\n');
    }

    // Проверяем покупки
    db.db.all(`
    SELECT u.telegram_id, u.full_name, COUNT(p.id) as purchases_count, SUM(p.amount) as total_spent
    FROM users u
    LEFT JOIN purchases p ON u.id = p.user_id AND p.status = 'paid'
    GROUP BY u.id
  `, (err, stats) => {
        if (!err && stats.length > 0) {
            console.log('💰 Статистика покупок:\n');
            stats.forEach(s => {
                if (s.purchases_count > 0) {
                    console.log(`   ${s.full_name || 'N/A'}: ${s.purchases_count} покупок на ${s.total_spent} сум`);
                }
            });
        }

        process.exit(0);
    });
});