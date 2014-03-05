var mongoose = require('mongoose');
var Schema = mongoose.Schema;

module.exports = function(configuration) {
	var History = new Schema({
		address: { type: String, index: true },
		createdAt: {type: Date, default: Date.now, expires: 60*60*24*7*2, index: true },
		hashRate: Number,
		balances: {
			sent: Number,
			confirmed: Number,
			unconverted: Number,
		}
	});
	
	mongoose.model('History', History);
};