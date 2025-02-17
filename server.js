const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { WebhookClient } = require('discord.js');
const path = require('path');
require('dotenv').config();

const app = express();

// Rate limiting için değişkenler
const webhookCooldowns = new Map();
const COOLDOWN_SECONDS = 5;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static dosya yolları - Basitleştirilmiş hali
app.use(express.static('public'));
app.use('/assets', express.static(path.join(__dirname, 'public/assets')));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Bir şeyler ters gitti!' });
});

// Ana sayfa
app.get('/', (req, res) => {
    try {
        res.render('index');
    } catch (error) {
        console.error('Render hatası:', error);
        res.status(500).send('Sayfa yüklenirken bir hata oluştu');
    }
});

// Webhook bilgilerini getir
app.get('/api/webhook-info', async (req, res) => {
    try {
        const { url } = req.query;
        
        if (!url) {
            return res.status(400).json({ error: 'Webhook URL required' });
        }

        // Webhook bilgilerini al
        const response = await axios.get(url);
        
        if (!response.data) {
            return res.status(400).json({ error: 'Geçersiz webhook URL' });
        }

        // Sadece gerekli bilgileri gönder
        res.json({
            name: response.data.name,
            avatar_url: response.data.avatar ? `https://cdn.discordapp.com/avatars/${response.data.id}/${response.data.avatar}.png` : 'https://cdn.discordapp.com/embed/avatars/0.png',
            channel_id: response.data.channel_id,
            guild_id: response.data.guild_id
        });
    } catch (error) {
        console.error('Webhook bilgi hatası:', error);
        res.status(500).json({ error: 'Webhook bilgileri alınamadı' });
    }
});

// Webhook'a embed gönder
app.post('/api/send-webhook', async (req, res) => {
    try {
        const { url, embedData } = req.body;

        if (!url) {
            return res.status(400).json({ error: 'Webhook URL gerekli' });
        }

        // Cooldown kontrolü
        const now = Date.now();
        const lastUsed = webhookCooldowns.get(url);
        
        if (lastUsed) {
            const timeElapsed = now - lastUsed;
            const timeRemaining = (COOLDOWN_SECONDS * 1000) - timeElapsed;
            
            if (timeRemaining > 0) {
                return res.status(429).json({
                    error: 'Please wait 5 seconds - Rate limit exceeded',
                    message: `Lütfen ${Math.ceil(timeRemaining / 1000)} saniye bekleyin`,
                    retryAfter: timeRemaining
                });
            }
        }

        // Webhook gönderme işlemi
        const webhookClient = new WebhookClient({ url });
        await webhookClient.send(embedData);

        // Cooldown güncelleme
        webhookCooldowns.set(url, now);
        setTimeout(() => webhookCooldowns.delete(url), COOLDOWN_SECONDS * 1000);

        res.json({ success: true });
    } catch (error) {
        console.error('Webhook gönderme hatası:', error);
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server http://localhost:${PORT} adresinde çalışıyor`);
}); 