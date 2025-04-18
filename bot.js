require('dotenv').config();
const express = require('express');
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const TOKEN = process.env.TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const ADMIN_LOG_CHANNEL = process.env.ADMIN_LOG_CHANNEL;
const PORT = process.env.PORT || 3000;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent
    ]
});

const app = express();
app.use(express.json());

// Dodaj obsługę CORS dla twojej strony
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', 'http://site32954.web1.titanaxe.com');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Endpoint zdrowia do sprawdzania czy bot jest online
app.get('/health', (req, res) => {
    res.status(200).send({
        status: 'online',
        botLoggedIn: !!client.user,
        timestamp: new Date().toISOString()
    });
});

app.post('/send-embed', async (req, res) => {
    console.log('Otrzymano żądanie /send-embed:', req.body);
    const { user_id, username, reason, timestamp, attempt } = req.body;

    if (!user_id || !username || !reason) {
        console.error('Brakujące dane w żądaniu:', req.body);
        return res.status(400).send('Brakuje danych.');
    }

    const embed = new EmbedBuilder()
        .setTitle('📥 Nowa aplikacja o WL')
        .addFields(
            { name: 'Użytkownik', value: username, inline: true },
            { name: 'ID', value: user_id, inline: true },
            { name: 'Próba', value: `${attempt || 1}/3`, inline: true },
            { name: 'Powód', value: reason }
        )
        .setColor(0x5865F2)
        .setTimestamp(new Date(timestamp || Date.now()));

    try {
        const channel = await client.channels.fetch(CHANNEL_ID);
        await channel.send({ embeds: [embed] });
        console.log('✅ Embed wysłany pomyślnie do kanału Discord');
        res.sendStatus(200);
    } catch (err) {
        console.error('❌ Błąd wysyłania embeda:', err);
        res.status(500).send('Błąd bota.');
    }
});

app.post('/send-notification', async (req, res) => {
    const { user_id, type, message } = req.body;

    if (!user_id || !message) {
        return res.status(400).send('Brakuje danych.');
    }

    try {
        const user = await client.users.fetch(user_id);

        const embed = new EmbedBuilder()
            .setTitle(type === 'approval' ? '✅ Aplikacja zatwierdzona' : '❌ Aplikacja odrzucona')
            .setDescription(message)
            .setColor(type === 'approval' ? 0x57F287 : 0xED4245)
            .setTimestamp();

        await user.send({ embeds: [embed] });

        const adminChannel = await client.channels.fetch(ADMIN_LOG_CHANNEL);
        await adminChannel.send(`📨 Wysłano powiadomienie do ${user.tag} (${user_id}) - ${type === 'approval' ? 'Zatwierdzenie' : 'Odrzucenie'}`);

        res.sendStatus(200);
    } catch (err) {
        console.error('❌ Błąd wysyłania powiadomienia:', err);
        res.status(500).send('Błąd bota.');
    }
});

client.once('ready', () => {
    console.log(`✅ Bot zalogowany jako ${client.user.tag}`);
    client.user.setPresence({
        activities: [{ name: 'czekam na zgłoszenia WL 👀' }],
        status: 'online'
    });

    app.listen(PORT, () => {
        console.log(`📡 Serwer nasłuchuje na porcie ${PORT}`);
    });
});

client.on('error', (error) => {
    console.error('❌ Błąd klienta Discord:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('❌ Nieobsłużone odrzucenie obietnicy:', error);
});

client.login(TOKEN).catch(error => {
    console.error('❌ Błąd logowania bota:', error);
    process.exit(1);
});
