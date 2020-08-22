module.exports = {
	name: 'javascript',
	description: 'Javascript!',
	execute(message, args) {
    const startFilter = message.content.split('\`\`\`javascript');
    const endFilter = startFilter[1].split('\`\`\`');
    const userCode = endFilter[0];
    var log = [];
    eval(userCode);
    console.log('Hello');
    console.log(log);
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