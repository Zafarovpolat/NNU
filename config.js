require('dotenv').config();

module.exports = {
    BOT_TOKEN: process.env.BOT_TOKEN,
    ADMIN_PORT: process.env.ADMIN_PORT || 3000,
    CARD_NUMBER: process.env.CARD_NUMBER,
    CARD_HOLDER: process.env.CARD_HOLDER,
    DB_PATH: './database.db'
};