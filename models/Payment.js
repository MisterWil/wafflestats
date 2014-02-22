var mongoose = require('mongoose');
var Schema = mongoose.Schema;

module.exports = function() {
	var Payment = new Schema({
		txn: { type: String, index: true, unique: true },
		amount: String,
		time: Date
	});
	
	mongoose.model('Payment', Payment);
};