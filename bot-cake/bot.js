const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const cors = require('cors');

// Переменные окружения
const TOKEN = process.env.BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL || 'https://cake-empire.netlify.app';
const PORT = process.env.PORT || 3000;

if (!TOKEN) {
    console.error('❌ BOT_TOKEN не найден! Добавьте его в переменные окружения');
    process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });
const app = express();

app.use(cors());
app.use(express.json());

// Хранилище (в памяти)
const users = new Map();

// Команда /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const firstName = msg.from.first_name;
    
    users.set(userId, {
        chatId,
        firstName,
        username: msg.from.username,
        lastActive: Date.now(),
        notifications: true
    });
    
    console.log(`✅ Новый пользователь: ${firstName} (${userId})`);
    
    const keyboard = {
        inline_keyboard: [
            [{ text: '🍰 Играть', web_app: { url: WEBAPP_URL } }],
            [{ text: '🔔 Уведомления', callback_data: 'toggle' }]
        ]
    };
    
    bot.sendMessage(chatId, 
        `🍰 *Добро пожаловать в Cake Empire, ${firstName}!*\n\n` +
        `Нажми "Играть" чтобы начать!`,
        { parse_mode: 'Markdown', reply_markup: keyboard }
    );
});

// Callback кнопок
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    
    if (query.data === 'toggle') {
        const user = users.get(userId) || {};
        user.notifications = !user.notifications;
        users.set(userId, user);
        
        await bot.sendMessage(chatId,
            user.notifications ? '🔔 Уведомления включены' : '🔕 Уведомления отключены'
        );
    }
    
    bot.answerCallbackQuery(query.id);
});

// API для уведомлений
app.post('/api/notify', async (req, res) => {
    const { userId, title, message } = req.body;
    
    const user = users.get(parseInt(userId));
    if (!user || !user.notifications) {
        return res.json({ success: false });
    }
    
    try {
        await bot.sendMessage(user.chatId, 
            `🔔 *${title}*\n\n${message}`,
            { parse_mode: 'Markdown' }
        );
        res.json({ success: true });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// Статус сервера
app.get('/', (req, res) => {
    res.json({ 
        status: 'ok',
        bot: '@cakeempirebot',
        users: users.size,
        webapp: WEBAPP_URL
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`🤖 Бот: @cakeempirebot`);
    console.log(`🎮 Игра: ${WEBAPP_URL}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    bot.stopPolling();
    process.exit();
});
