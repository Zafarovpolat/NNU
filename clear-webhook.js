const https = require('https');
require('dotenv').config();

const token = process.env.BOT_TOKEN;

if (!token) {
    console.error('❌ BOT_TOKEN не найден в .env файле');
    process.exit(1);
}

console.log('🔄 Удаление webhook...');

https.get(`https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=true`, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        try {
            const result = JSON.parse(data);
            console.log('Ответ:', result);
            if (result.ok) {
                console.log('\n✅ Webhook удален успешно!');
                console.log('✅ Теперь можно запустить бота: npm run bot');
            } else {
                console.log('⚠️ Ошибка:', result.description);
            }
        } catch (e) {
            console.log('Ответ:', data);
        }
    });
}).on('error', (err) => {
    console.error('❌ Ошибка:', err);
});