var mongoose = require('mongoose');
var Schema = mongoose.Schema;

module.exports = function() {
	var Address = new Schema({
		address: String,
		data: [{
			retrieved: { type: Date, default: Date.now },
			wafflesVersion: String,
			hashRate: Number,
			balances: {
				sent: Number,
				confirmed: Number,
				unconverted: Number,
			}
		}]
	});
	
	mongoose.model('Address', Address);
};