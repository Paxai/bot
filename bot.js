const express = require('express');
const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

let memberList = [];

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

client.once('ready', async () => {
  console.log(`Zalogowano jako ${client.user.tag}`);
  const guild = await client.guilds.fetch(process.env.GUILD_ID);
  const members = await guild.members.fetch();

  memberList = members.map(member => ({
    username: member.user.username,
    discriminator: member.user.discriminator,
    tag: member.user.tag,
    avatar: member.user.displayAvatarURL({ dynamic: true, size: 64 })
  }));

  console.log(`Załadowano ${memberList.length} członków`);
});

// Endpoint: lista członków
app.get('/members', (req, res) => {
  res.json({ members: memberList });
});

client.login(process.env.DISCORD_TOKEN);

app.listen(PORT, () => {
  console.log(`API działa na porcie ${PORT}`);
});
