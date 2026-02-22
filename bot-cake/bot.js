const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

// ---------- КОНФИГУРАЦИЯ ----------
const TOKEN = process.env.BOT_TOKEN; // Токен из переменных окружения Railway
const WEBAPP_URL = process.env.WEBAPP_URL || 'https://cake-empire.netlify.app'; // URL вашей игры

const bot = new TelegramBot(TOKEN, { polling: true });
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// Хранилище пользователей (в памяти, при перезапуске очистится)
// Для продакшена используйте БД (MongoDB, PostgreSQL и т.д.)
const users = new Map(); // userId -> { chatId, firstName, notifications: true }

// ---------- КОМАНДЫ БОТА ----------

// Команда /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const firstName = msg.from.first_name;
    
    // Сохраняем пользователя
    users.set(userId, {
        chatId,
        firstName,
        username: msg.from.username,
        lastActive: Date.now(),
        notifications: true
    });
    
    console.log(`Новый пользователь: ${firstName} (${userId})`);
    
    const keyboard = {
        inline_keyboard: [
            [{ text: '🍰 Играть', web_app: { url: WEBAPP_URL } }],
            [{ text: '🔔 Уведомления', callback_data: 'toggle_notifications' }],
            [{ text: '🏆 Топ игроков', callback_data: 'leaderboard' }]
        ]
    };
    
    bot.sendMessage(chatId, 
        `🍰 *Добро пожаловать в Cake Empire, ${firstName}!*\n\n` +
        `Кликай на тортик, прокачивай бустеры и соревнуйся с друзьями!\n\n` +
        `👇 Нажми "Играть" чтобы начать`,
        { 
            parse_mode: 'Markdown',
            reply_markup: keyboard 
        }
    );
});

// Обработка callback кнопок
bot.on('callback_query', async (callbackQuery) => {
    const msg = callbackQuery.message;
    const data = callbackQuery.data;
    const userId = callbackQuery.from.id;
    const chatId = msg.chat.id;
    
    const user = users.get(userId) || {};
    
    switch(data) {
        case 'toggle_notifications':
            user.notifications = !user.notifications;
            users.set(userId, user);
            
            await bot.sendMessage(chatId, 
                user.notifications ? 
                '🔔 *Уведомления включены*\nВы будете получать напоминания об игре' : 
                '🔕 *Уведомления отключены*\nВы больше не будете получать напоминания',
                { parse_mode: 'Markdown' }
            );
            break;
            
        case 'leaderboard':
            await bot.sendMessage(chatId,
                '🏆 *Топ игроков*\n\n' +
                'Скоро здесь будет рейтинг!\n' +
                'А пока играйте и набирайте очки!',
                { parse_mode: 'Markdown' }
            );
            break;
    }
    
    bot.answerCallbackQuery(callbackQuery.id);
});

// ---------- API ДЛЯ УВЕДОМЛЕНИЙ ----------

// Проверка работы сервера
app.get('/', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'Cake Empire Bot is running!',
        users: users.size
    });
});

// Отправить уведомление пользователю
app.post('/api/notify', async (req, res) => {
    const { userId, title, message } = req.body;
    
    const user = users.get(parseInt(userId));
    if (!user) {
        return res.json({ success: false, reason: 'user_not_found' });
    }
    
    if (!user.notifications) {
        return res.json({ success: false, reason: 'notifications_disabled' });
    }
    
    try {
        const keyboard = {
            inline_keyboard: [
                [{ text: '🍰 Играть', web_app: { url: WEBAPP_URL } }]
            ]
        };
        
        await bot.sendMessage(user.chatId, 
            `🔔 *${title}*\n\n${message}`,
            { 
                parse_mode: 'Markdown',
                reply_markup: keyboard 
            }
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
        activeUsers: Array.from(users.values()).filter(u => u.notifications).length
    });
});

// ---------- ЗАПУСК ----------
app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`🤖 Бот @cakeempirebot активен`);
    console.log(`🎮 WebApp URL: ${WEBAPP_URL}`);
});

// Обработка ошибок
bot.on('polling_error', (error) => {
    console.log('Polling error:', error);
});

// Graceful shutdown
process.on('SIGINT', () => {
    bot.stopPolling();
    process.exit();
});