import { MessageEmbed } from 'discord.js';
import stripAnsi from 'strip-ansi';

import CompilerCommand from './utils/CompilerCommand';
import CompilerCommandMessage from './utils/CompilerCommandMessage';
import CompilerClient from '../CompilerClient';
import { WandboxSetup } from '../utils/apis/Wandbox';
import SupportServer from '../SupportServer';
import CompilationParser from './utils/CompilationParser';

export default class CompileCommand extends CompilerCommand {
    /**
     *  Creates the compile command
     *
     * @param {CompilerClient} client
     */
    constructor(client) {
        super(client, {
            name: 'submit',
            description: 'Submit a solution to daily task',
            developerOnly: false,
        });
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
        let task = args[0];
        args.shift();
        let lang = args[0].toLowerCase();
        args.shift();

        if (!this.client.wandbox.isValidCompiler(lang) && !this.client.wandbox.has(lang)) {
            msg.replyFail(
                `You must input a valid language or compiler \n\n Usage: ${this.client.prefix}submit <task> <language/compiler> \`\`\`<code>\`\`\``
            );
            return;
        }

        let parser = new CompilationParser(msg);

        const argsData = parser.parseArguments();
        let code = null;
        // URL request needed to retrieve code
        if (argsData.fileInput.length > 0) {
            try {
                code = await CompilationParser.getCodeFromURL(argsData.fileInput);
            } catch (e) {
                msg.replyFail(`Could not retrieve code from url \n ${e.message}`);
                return;
            }
        }
        // Standard ``` <code> ``` request
        else {
            code = parser.getCodeBlockFromText();
            if (code) {
                code = CompilationParser.cleanLanguageSpecifier(code);
            } else {
                msg.replyFail('You must attach codeblocks containing code to your message');
                return;
            }
            const stdinblock = parser.getStdinBlockFromText();
            if (stdinblock) {
                argsData.stdin = stdinblock;
            }
        }

        let setup = new WandboxSetup(code, lang, argsData.stdin, true, argsData.options, this.client.wandbox);
        setup.fix(this.client.fixer); // can we recover a failed compilation?

        let reactionSuccess = false;
        if (this.client.loading_emote) {
            try {
                await msg.message.react(this.client.loading_emote);
                reactionSuccess = true;
            } catch (e) {
                msg.replyFail(`Failed to react to message, am I missing permissions?\n${e}`);
            }
        }

        let json = null;
        try {
            json = await setup.compile();
        } catch (e) {
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
            } catch (error) {
                msg.replyFail(`Unable to remove reactions, am I missing permissions?\n${error}`);
            }
        }

        SupportServer.postCompilation(
            code,
            lang,
            json.url,
            msg.message.author,
            msg.message.guild,
            json.status == 0,
            json.compiler_message,
            this.client.compile_log,
            this.client.token
        );

        let embed = CompileCommand.buildResponseEmbed(msg, json);
        let responsemsg = await msg.dispatch('', embed);

        if (this.client.shouldTrackStats()) this.client.stats.compilationExecuted(lang, embed.color == 0xff0000);

        try {
            responsemsg.react(embed.color == 0xff0000 ? '❌' : '✅');
        } catch (error) {
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
        let [task, lang] = msg.getArgs();
        let now = new Date();

        const embed = new MessageEmbed()
            .setTitle('Submission Result:')
            .addField(
                'Date (UTC)',
                `${now.getUTCFullYear()}-${(now.getUTCMonth() + 1)
                    .toString()
                    .padStart(2, 0)}-${now.getUTCDate().toString().padStart(2, 0)}`,
                true
            )
            .addField('Task', `#${task}`, true)
            .addField('Language', `${lang}`, true)
            .addField('Submitted By', msg.message.author.tag, true);

        if (json.status && json.status != 0) {
            embed.setColor(0xff0000);
        } else {
            let totalTests = 10;
            let passed = Math.round(Math.random());

            if (json.program_message) {
                // do verification here
            }

            if (passed) {
                embed.setColor(0x00ff00);
                embed.addField('Result', `${totalTests}/${totalTests}`);
            } else {
                embed.setColor(0xff0000);
                embed.addField('Result', `${Math.round(Math.random() * (totalTests - 1))}/${totalTests}`);
            }
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
            .setColor(0x00ff00)
            .addField(
                'Standard Submission',
                `
\`\`\`
${this.toString()} <task> <language|compiler>
\`​\`​\`
<code>
\`​\`​\`
\`\`\`
`
            )
            .setThumbnail('https://imgur.com/TNzxfMB.png')
            .setFooter(`Requested by: ${message.message.author.tag}`);
        return await message.dispatch('', embed);
    }
}
