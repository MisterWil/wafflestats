var mongoose = require('mongoose');
var Schema = mongoose.Schema;

module.exports = function() {
	var History = new Schema({
		address: String,
		createdAt: {type: Date, default: Date.now, expires: 60*60*24*7*4 },
		hashRate: Number,
		balances: {
			sent: Number,
			confirmed: Number,
			unconverted: Number,
		}
	});
	
	mongoose.model('History', History);
};