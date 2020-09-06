import { MessageEmbed } from 'discord.js'
import stripAnsi from 'strip-ansi';

import CompilerCommand from './utils/CompilerCommand';
import CompilerCommandMessage from './utils/CompilerCommandMessage'
import CompilerClient from '../CompilerClient'
import { WandboxSetup } from '../utils/apis/Wandbox';
import SupportServer from './../SupportServer';
import CompilationParser from './utils/CompilationParser';
import * as axios from 'axios';

let level;
export default class CompileCommand extends CompilerCommand {
    /**
     *  Creates the compile command
     * 
     * @param {CompilerClient} client
     */    
    constructor(client) {
        super(client, {
            name: 'compile',
            description: 'Compiles a script \nNote: This command\'s code input MUST be encapsulated in codeblocks',
            developerOnly: false
        });
        this.validator = new Validator();
    }

    /**
     * Function which is executed when the command is requested by a user
     *
     * @param {CompilerCommandMessage} msg
     */
    async run(msg) {
        const args = msg.getArgs();
		
		if (args.length < 1) {
			return await this.help(msg);
		}
		
        level = args[0].toLowerCase();
        let lang = args[1].toLowerCase();

        args.shift();

        if (!this.client.wandbox.isValidCompiler(lang) && !this.client.wandbox.has(lang)) {
            msg.replyFail(`You must input a valid level, language or compiler \n\n Usage: ${this.client.prefix}compile <level> <language/compiler> \`\`\`<code>\`\`\``);
            return;
        }

        let parser = new CompilationParser(msg);

        const argsData = parser.parseArguments();
        let code = null;
        // URL request needed to retrieve code
        if (argsData.fileInput.length > 0) {
            try {
                code = await CompilationParser.getCodeFromURL(argsData.fileInput);
            }
            catch (e) {
                msg.replyFail(`Could not retrieve code from url \n ${e.message}`);
                return;
            }
        }
        // Standard ``` <code> ``` request
        else {
            code = parser.getCodeBlockFromText();
            if (code) {
                code = CompilationParser.cleanLanguageSpecifier(code);
            }
            else {
                msg.replyFail('You must attach codeblocks containing code to your message');
                return;
            }
            // const stdinblock = parser.getStdinBlockFromText();
            const stdinblock = this.validator.getValidStdin(level);
            if (stdinblock) {
                argsData.stdin = stdinblock;
            }
        }

        let setup = new WandboxSetup(code, lang, argsData.stdin, true, argsData.options, this.client.wandbox);
        setup.fix(this.client.fixer); // can we recover a failed compilation?

        let reactionSuccess = false;
        if (this.client.loading_emote)
        {
            try {
                await msg.message.react(this.client.loading_emote);
                reactionSuccess = true;
            }
            catch (e) {
                msg.replyFail(`Failed to react to message, am I missing permissions?\n${e}`);
            }    
        }

        let json = null;
        try {
            json = await setup.compile();
        }
        catch (e) {
            msg.replyFail(`Wandbox request failure \n ${e.message} \nPlease try again later`);
            return;
        }
        if (!json) {
            msg.replyFail(`Invalid Wandbox response \nPlease try again later`);
            return;
        }

        //remove our react
        if (reactionSuccess && this.client.loading_emote) {
            try {
                await msg.message.reactions.resolve(this.client.loading_emote).users.remove(this.client.user);
            }
            catch (error) {
                msg.replyFail(`Unable to remove reactions, am I missing permissions?\n${error}`);
            }
        }   

        SupportServer.postCompilation(code, lang, json.url, msg.message.author, msg.message.guild, json.status == 0, json.compiler_message, this.client.compile_log, this.client.token);

        let embed = CompileCommand.buildResponseEmbed(msg, json);
        let responsemsg = await msg.dispatch('', embed);
        
        if (this.client.shouldTrackStats())
            this.client.stats.compilationExecuted(lang, embed.color == 0xFF0000);

        try {
            responsemsg.react((embed.color == 0xFF0000)?'❌':'☝');
        }
        catch (error) {
            msg.replyFail(`Unable to react to message, am I missing permissions?\n${error}`);
            return;
        }
    }

    /**
     * Builds a compilation response embed
     * 
     * @param {CompilerCommandMessage} msg 
     * @param {*} json 
     */
    static buildResponseEmbed(msg, json) {
        const validator = new Validator();
        const embed = new MessageEmbed()
        .setTitle('Compilation Results:')
        .setFooter("Requested by: " + msg.message.author.tag)
        .setColor(0x00FF00);
        if (json.status) {
            if (json.status != 0) {
                embed.setColor((0xFF0000));
            }
            else {
                embed.setColor(0x00FF00);
                embed.addField('Status code', `Finished with exit code: ${json.status}`);    
            }
        }

        if (json.signal) {
            embed.addField('Signal', `\`\`\`${json.signal}\`\`\``);
        }

        if (json.compiler_message) {
            if (json.compiler_message.length >= 1017) {
                json.compiler_message = json.compiler_message.substring(0, 1016);
            }
            /**
             * Certain compiler outputs use unicode control characters that
             * make the user experience look nice (colors, etc). This ruins
             * the look of the compiler messages in discord, so we strip them
             * out with stripAnsi()
             */
            json.compiler_message = stripAnsi(json.compiler_message);
            embed.addField('Compiler Output', `\`\`\`${json.compiler_message}\n\`\`\`\n`);
        }

        if (json.program_message) {
            /**
             * Annoyingly, people can print '`' chars and ruin the formatting of our
             * program output. To counteract this, we can place a unicode zero-width
             * character to escape it.
             */
            json.program_message = json.program_message.replace(/`/g, "\u200B"+'`');

            if (json.program_message.length >= 1016) {
                json.program_message = json.program_message.substring(0, 1015);
            }

            json.program_message = stripAnsi(json.program_message);

            //Validation goes here
            let test = false;
            if (json.program_message === validator.getValidStdout(level)) {
                test = true;
            }

            embed.addField('Program Output', `\`\`\`\n${json.program_message}\n\`\`\`\n Valid: ${(!test)?'❌':'✅'}`);
        }

        return embed;
    }

    /**
     * Displays the help information for the given command
     *
     * @param {CompilerCommandMessage} message
     */
    async help(message) {
        const embed = new MessageEmbed()
            .setTitle('Command Usage')
            .setDescription(`*${this.description}*`)
            .setColor(0x00FF00)
            .addField('Standard compile', `${this.toString()} <level> <language|compiler> \\\`\\\`\\\`<code>\\\`\\\`\\\``)
            .addField('Compile w/ options', `${this.toString()} <level> <language|compiler> <options> \\\`\\\`\\\`<code>\\\`\\\`\\\``)
            .addField('Compile w/ stdin', `${this.toString()} <level> <language|compiler> | <stdin> \\\`\\\`\\\`<code>\\\`\\\`\\\``)
            .addField('Compile w/ url code', `${this.toString()} <level> <language|compiler> < http://online.file/url`)
            .setThumbnail('https://imgur.com/TNzxfMB.png')
            .setFooter(`Requested by: ${message.message.author.tag}`)
        return await message.dispatch('', embed);
    }

}

class Validator {
    constructor() {
        this.validationData = {};
        axios.get('https://alpha-test-bot.firebaseio.com/key.json')
        .then(response => {
            let key = Object.values(response.data).reduce((acc, item) => acc + item, '');
            axios.get('https://alpha-test-bot.firebaseio.com/valid.json')
            .then(response => {
                this.validationData = Object.values(response.data).filter((item) => {
                    if (item.key === key) {
                        return item;
                    }
                });
            });
        })
        .catch(error => {
            console.log(error);
        });
    }

    getValidStdin(level) {
        return this.validationData[level].reduce((acc, out, idx, arr) => {
            if (idx === arr.length - 1) {
              return acc + out.input
            }
            return acc + out.input + '\n'
        }, '');
    }
    
    getValidStdout(level) {
        return this.validationData[level].reduce((acc, out) => acc + out.output + '\n', '');
    }
}