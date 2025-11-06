const { exec } = require('child_process');

console.log('🔍 Поиск запущенных процессов бота...');

if (process.platform === 'win32') {
    // Windows
    exec('tasklist', (err, stdout) => {
        if (stdout.includes('node.exe')) {
            exec('taskkill /F /IM node.exe', (err) => {
                if (err) {
                    console.error('❌ Ошибка:', err);
                } else {
                    console.log('✅ Все процессы Node.js остановлены');
                }
            });
        } else {
            console.log('✅ Процессы не найдены');
        }
    });
} else {
    // Linux/Mac
    exec('pkill -f node', (err) => {
        if (err) {
            console.log('✅ Процессы не найдены или уже остановлены');
        } else {
            console.log('✅ Все процессы Node.js остановлены');
        }
    });
}

setTimeout(() => {
    console.log('\n✅ Теперь можно запустить бота заново: npm start');
    process.exit(0);
}, 1000);