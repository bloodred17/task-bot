// Require discord.js package
require('dotenv').config();
const fs = require('fs');
const config = require('./config.json');
const Discord = require("discord.js");


// Create a new client using the new keyword
const client = new Discord.Client();

client.commands = new Discord.Collection();
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);

    // set a new item in the Collection
    // with the key as the command name and the value as the exported module
    client.commands.set(command.name, command);
}

// Display a message once the bot has started
client.on("ready", () =>{
    console.log(`Logged in as ${client.user.tag}!`);
});

// Check messages for a specific command
client.on("message", message =>{
    if (!message.content.startsWith(config.prefix) || message.author.bot) return;
    const args = message.content.slice(config.prefix.length).trim().substr(0,50).split(/ +/);
    console.log(args);
    const commandName = args.shift().toLowerCase();
    if (!client.commands.has(commandName)) return;
    const command = client.commands.get(commandName);
    try {
		command.execute(message, args);
    } catch(err) {
        console.log(err);
    }
    finally {
        console.log('Done.');
    }
});
// .slice(config.prefix.length).trim().split(' ')
// Log in the bot with the token
client.login(process.env.TOKEN);