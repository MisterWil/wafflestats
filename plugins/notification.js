var log = require('../log');

var mongoose = require('mongoose');
var History = mongoose.model('History');
var Address = mongoose.model('Address');
var Payment = mongoose.model('Payment');

function update(address, data) {
	updatePayouts(address, data);
	checkHashrate(address);
}
exports.update = update;

function updatePayouts(address, data) {
	if (data !== undefined && data.recent_payments !== undefined) {
		var paymentsLength = data.recent_payments.length;

		for ( var i = 0; i < paymentsLength; i++) {
			var paymentData = data.recent_payments[i];

			var payment = new Payment({
				txn : paymentData.txn,
				amount : paymentData.amount,
				time : new Date(paymentData.time)
			});

			payment.save(function(err, payment) {
				if (err) {
					return log.error(err);
				}

				Address.update({
					address : address
				}, {
					$addToSet : {
						payments : {
							txn : payment.txn
						}
					}
				}, {
					upsert : true
				}, function(err, num, raw) {
					if (err) {
						return log.error(err);
					}
					
					console.log("SEND NOTIFICATION OF PAYOUT - " + payment.txn);
				});
			});
		}
	}
}

function checkHashrate(address) {
	
}