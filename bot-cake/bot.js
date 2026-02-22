const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const cors = require('cors');

// ---------- КОНФИГУРАЦИЯ ----------
const TOKEN = process.env.BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL || 'https://resplendent-begonia-113097.netlify.app/';
const PORT = process.env.PORT || 3000;

if (!TOKEN) {
    console.error('❌ BOT_TOKEN не найден! Добавьте его в переменные окружения Render');
    process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });
const app = express();

app.use(cors());
app.use(express.json());

// Хранилище пользователей
const users = new Map();

// ---------- КОМАНДЫ БОТА ----------

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
            [{ text: '🔔 Уведомления', callback_data: 'toggle_notifications' }]
        ]
    };
    
    bot.sendMessage(chatId, 
        `🍰 *Добро пожаловать в Cake Empire, ${firstName}!*\n\n` +
        `Кликай на тортик, прокачивай бустеры и соревнуйся с друзьями!`,
        { parse_mode: 'Markdown', reply_markup: keyboard }
    );
});

// Обработка callback кнопок
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    
    if (query.data === 'toggle_notifications') {
        const user = users.get(userId) || {};
        user.notifications = !user.notifications;
        users.set(userId, user);
        
        await bot.sendMessage(chatId,
            user.notifications ? 
            '🔔 Уведомления включены' : 
            '🔕 Уведомления отключены'
        );
    }
    
    bot.answerCallbackQuery(query.id);
});

// ---------- API ДЛЯ УВЕДОМЛЕНИЙ ----------

// Проверка работы сервера
app.get('/', (req, res) => {
    res.json({ 
        status: 'ok',
        message: 'Cake Empire Bot is running!',
        bot: '@cakeempirebot',
        users: users.size,
        webapp: WEBAPP_URL,
        timestamp: new Date().toISOString()
    });
});

// Отправить уведомление пользователю
app.post('/api/notify', async (req, res) => {
    const { userId, title, message } = req.body;
    
    const user = users.get(parseInt(userId));
    if (!user || !user.notifications) {
        return res.json({ success: false, reason: 'user_not_found_or_disabled' });
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

// Статистика
app.get('/api/stats', (req, res) => {
    res.json({
        totalUsers: users.size,
        activeUsers: Array.from(users.values()).filter(u => u.notifications).length,
        users: Array.from(users.entries()).map(([id, u]) => ({
            id,
            name: u.firstName,
            username: u.username,
            notifications: u.notifications
        }))
    });
});

// ---------- ЗАПУСК СЕРВЕРА ----------
app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`🤖 Бот: @cakeempirebot`);
    console.log(`🎮 Игра: ${WEBAPP_URL}`);
    console.log(`📊 Статистика: http://localhost:${PORT}/api/stats`);
});

// Обработка ошибок
bot.on('polling_error', (error) => {
    console.log('⚠️ Ошибка polling:', error.message);
});

console.log('✅ Бот запущен и ожидает сообщения...');
