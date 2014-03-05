var mongoose = require('mongoose');
var Schema = mongoose.Schema;

module.exports = function(configuration) {
	var Address = new Schema({
		address: { type: String, index: true },
		lastVisited: {type: Date, default: Date.now, index: true},
		hitCount: { type: Number, default: 0 }
	});
	
	mongoose.model('Address', Address);
};