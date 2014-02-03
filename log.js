var fs = require('fs');

var logger = require('tracer').console({
	transport : function(data) {
		console.log(data.output);
		fs.open('./wafflestats.log', 'a', 0666, function(e, id) {
			fs.write(id, data.output+"\n", null, 'utf8', function() {
				fs.close(id, function() {
				});
			});
		});
	}
});

module.exports = logger;