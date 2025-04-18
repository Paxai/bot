const { Client, GatewayIntentBits, Partials, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Constants
const PORT = process.env.PORT || 3000;
const GUILD_ID = '1359567770827751584';
const WHITELIST_ROLE_ID = '1361817341935222845';
const ADMIN_ROLE_ID = '1361775341106106611';
const APPLICATION_CHANNEL_ID = process.env.APPLICATION_CHANNEL_ID; // Set this in .env

// Initialize Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel, Partials.Message]
});

// Initialize Express
const app = express();
app.use(bodyParser.json());

// Discord bot ready event
client.once('ready', () => {
  console.log(`Bot is online as ${client.user.tag}`);
  
  // Set activity status
  client.user.setActivity('whitelist applications', { type: 'WATCHING' });
});

// API Endpoints

// Endpoint to receive new applications
app.post('/send-embed', async (req, res) => {
  try {
    const { user_id, username, reason, timestamp, attempt } = req.body;
    
    if (!user_id || !username || !reason) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const guild = client.guilds.cache.get(GUILD_ID);
    if (!guild) {
      return res.status(404).json({ error: 'Guild not found' });
    }
    
    const applicationChannel = guild.channels.cache.get(APPLICATION_CHANNEL_ID);
    if (!applicationChannel) {
      return res.status(404).json({ error: 'Application channel not found' });
    }
    
    // Create embed with application details
    const embed = new EmbedBuilder()
      .setTitle(`Nowa aplikacja na whitelistę`)
      .setColor(0x5865F2)
      .setDescription(`**Użytkownik:** <@${user_id}> (${username})`)
      .addFields(
        { name: 'Powód:', value: reason.length > 1024 ? reason.substring(0, 1021) + '...' : reason },
        { name: 'Czas złożenia:', value: timestamp || new Date().toISOString() },
        { name: 'Próba:', value: `${attempt || 1}/3` }
      )
      .setTimestamp()
      .setFooter({ text: `ID: ${user_id}` });

    // Create buttons for admin actions (these will link to the website admin panel)
    const websiteUrl = 'http://site32954.web1.titanaxe.com/admin.php';
    
    const actionRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setLabel('Panel Administratora')
          .setStyle(ButtonStyle.Link)
          .setURL(websiteUrl)
      );
      
    await applicationChannel.send({ embeds: [embed], components: [actionRow] });
    
    // Notify the user that their application has been submitted
    try {
      const member = await guild.members.fetch(user_id);
      const userEmbed = new EmbedBuilder()
        .setTitle('Aplikacja na whitelistę została złożona')
        .setColor(0x57F287)
        .setDescription(`Twoja aplikacja na whitelistę została przyjęta do rozpatrzenia.\nPróba: ${attempt || 1}/3`)
        .setTimestamp();
        
      await member.send({ embeds: [userEmbed] });
    } catch (dmError) {
      // DM could be disabled, just log the error
      console.log(`Couldn't send DM to user ${user_id}: ${dmError.message}`);
    }
    
    return res.status(200).json({ success: true });
    
  } catch (error) {
    console.error('Error sending application embed:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint to send notifications to users
app.post('/send-notification', async (req, res) => {
  try {
    const { user_id, type, message } = req.body;
    
    if (!user_id || !type || !message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const guild = client.guilds.cache.get(GUILD_ID);
    if (!guild) {
      return res.status(404).json({ error: 'Guild not found' });
    }
    
    try {
      const member = await guild.members.fetch(user_id);
      
      let color, title;
      
      if (type === 'approval') {
        color = 0x57F287; // Green
        title = 'Aplikacja zatwierdzona!';
        
        // Add whitelist role
        try {
          await member.roles.add(WHITELIST_ROLE_ID);
        } catch (roleError) {
          console.log(`Couldn't add role to user ${user_id}: ${roleError.message}`);
        }
      } else if (type === 'rejection') {
        color = 0xED4245; // Red
        title = 'Aplikacja odrzucona';
      } else {
        color = 0x5865F2; // Discord blue
        title = 'Powiadomienie';
      }
      
      const notificationEmbed = new EmbedBuilder()
        .setTitle(title)
        .setColor(color)
        .setDescription(message)
        .setTimestamp();
        
      await member.send({ embeds: [notificationEmbed] });
      
      return res.status(200).json({ success: true });
      
    } catch (userError) {
      console.error(`Error sending notification to user ${user_id}:`, userError);
      return res.status(404).json({ error: 'User not found or could not send DM' });
    }
    
  } catch (error) {
    console.error('Error sending notification:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Add slash commands
client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;
  
  const { commandName } = interaction;
  
  if (commandName === 'whitelist') {
    // Check if the user has admin role
    const member = interaction.member;
    if (!member.roles.cache.has(ADMIN_ROLE_ID)) {
      return interaction.reply({ 
        content: 'Nie masz uprawnień do użycia tej komendy.', 
        ephemeral: true 
      });
    }
    
    const subcommand = interaction.options.getSubcommand();
    
    if (subcommand === 'status') {
      const targetUser = interaction.options.getUser('użytkownik');
      const targetMember = await interaction.guild.members.fetch(targetUser.id);
      
      const hasWhitelistRole = targetMember.roles.cache.has(WHITELIST_ROLE_ID);
      
      const statusEmbed = new EmbedBuilder()
        .setTitle('Status Whitelisty')
        .setColor(hasWhitelistRole ? 0x57F287 : 0xED4245)
        .setDescription(`Użytkownik ${targetUser} ${hasWhitelistRole ? 'ma' : 'nie ma'} dostępu do whitelisty.`)
        .setTimestamp();
        
      return interaction.reply({ embeds: [statusEmbed], ephemeral: true });
    }
    
    if (subcommand === 'info') {
      const infoEmbed = new EmbedBuilder()
        .setTitle('Informacje o Systemie Whitelisty')
        .setColor(0x5865F2)
        .setDescription(`Aby złożyć aplikację na whitelistę, zaloguj się przez Discord na stronie: http://site32954.web1.titanaxe.com/\n\nMożesz złożyć maksymalnie 3 aplikacje. Każda aplikacja jest rozpatrywana przez administratorów.`)
        .setTimestamp();
        
      return interaction.reply({ embeds: [infoEmbed] });
    }
  }
});

// Register slash commands when the bot starts
client.once('ready', async () => {
  try {
    const guild = client.guilds.cache.get(GUILD_ID);
    if (!guild) {
      console.error(`Guild with ID ${GUILD_ID} not found`);
      return;
    }
    
    const commands = [
      {
        name: 'whitelist',
        description: 'Komendy związane z systemem whitelisty',
        options: [
          {
            name: 'status',
            type: 1, // SUB_COMMAND
            description: 'Sprawdź status whitelist użytkownika',
            options: [
              {
                name: 'użytkownik',
                type: 6, // USER
                description: 'Użytkownik do sprawdzenia',
                required: true
              }
            ]
          },
          {
            name: 'info',
            type: 1, // SUB_COMMAND
            description: 'Informacje o systemie whitelisty'
          }
        ]
      }
    ];
    
    await guild.commands.set(commands);
    console.log('Slash commands registered successfully');
  } catch (error) {
    console.error('Error registering slash commands:', error);
  }
});

// Start the Express server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Login to Discord
client.login(process.env.DISCORD_TOKEN);
