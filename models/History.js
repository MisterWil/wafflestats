var mongoose = require('mongoose');
var Schema = mongoose.Schema;

module.exports = function(configuration) {
	var History = new Schema({
		address: { type: String },
		createdAt: {type: Date, default: Date.now, expires: 60*60*24*7*2, index: true },
		hashRate: Number,
		workerHashrates: [{
			username: { type: String },
			hashRate: { type: Number },
			lastSeen: { type: Date }
		}],
		balances: {
			sent: Number,
			confirmed: Number,
			unconverted: Number,
		}
	});
	
	// Compound Index
	History.index({ address: 1, createdAt: 1 });
	
	mongoose.model('History', History);
};