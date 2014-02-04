var log = require('../log');

var mongoose = require('mongoose');
var Address = mongoose.model('Address');
var History = mongoose.model('History');

module.exports = function () {
	Address.find(function(err, addresses) {
		if (err) {
			log.error(err);
			return;
		}
		
		var addressesLen = addresses.length;
		
		for (var a = 0; a < addressesLen; a++) {
			var address = addresses[a];
			
			var btcAddr = address.address;
			
			var dataLen = address.data.length;

			var newHistDocs = [];
			
			for (var d = 0; d < dataLen; d++) {
				var data = address.data[d];
				
				var hist = {
					address: btcAddr,
					createdAt: data.retrieved,
					hashRate: data.hashRate,
					balances: {
						sent: data.balances.sent,
						confirmed: data.balances.confirmed,
						unconverted: data.balances.unconverted,
					}
				};
				
				newHistDocs.push(hist);
			}
			
			History.create(newHistDocs, function (createError) {
				if (createError) {
					log.err(createError);
				} else {
					address.remove(function (removeError) {
						if (removeError) {
							log.err(removeError);
						}
					});
				}
			});
		}
	});
};