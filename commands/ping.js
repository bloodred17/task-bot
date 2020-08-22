module.exports = {
	name: 'javascript',
	description: 'Javascript!',
	execute(message, args) {
    const startFilter = message.content.split('\`\`\`javascript');
    const endFilter = startFilter[1].split('\`\`\`');
    const userCode = endFilter[0];
    var capcon = require('capture-console');
    var stdio = capcon.captureStdio(function scope() {
      eval(userCode);
    });
    console.log(stdio);
    const regex = /true/g;
    console.log(stdio.stdout.search(regex));
		if (!args.length) {
			return message.channel.send(`You didn't provide any arguments, ${message.author}!`);
		} else if (args[0] === 'beginner') {
      return message.channel.send('beginner');
		}
		// message.channel.send(`Arguments: ${args}\nArguments length: ${args.length}`);
	},
};

// function createLog() {
//   var log = [];
//   console.log = function() {
//     log.push([].slice.call(arguments));
//   };
// }