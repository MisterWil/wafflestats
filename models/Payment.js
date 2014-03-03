var mongoose = require('mongoose');
var Schema = mongoose.Schema;

module.exports = function(configuration) {
	var Payment = new Schema({
	    address: { type: String, index: true },
		txn: { type: String, index: true },
		amount: String,
		time: Date
	});

    	
	// Set compound/multifield index in mongodb
	Payment.index({
        address : 1,
        txn : 1
    }, {
        unique : true
    });

    mongoose.model('Payment', Payment);
};