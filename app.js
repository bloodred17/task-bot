// Require discord.js package
require('dotenv').config();
const Discord = require("discord.js");

// Create a new client using the new keyword
const client = new Discord.Client();

// Display a message once the bot has started
client.on("ready", () =>{
    console.log(`Logged in as ${client.user.tag}!`);
});

// Check messages for a specific command
client.on("message", msg =>{
    // Send back a reply when the specific command has been written
    if (msg.content === "!hello"){
        msg.reply("Hello world!");
    }
});

// Log in the bot with the token
client.login(process.env.TOKEN);