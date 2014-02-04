var express = require('express');
var mongoose = require('mongoose');
var app = express();

var log = require('./log');

//Initialize mongoose schemas
require('./models/models.js').initialize();

app.configure('development', function() {
	mongoose.connect('mongodb://localhost/waffles-dev');
});

app.configure('production', function() {
	mongoose.connect('mongodb://localhost/waffles');
});

var Address = mongoose.model('Address');
var History = mongoose.model('History');

var writeCount = 1;

// Dump the history table
History.collection.drop(function (err) {

	// Upgrade the entire address table
	Address.find(function(err, addresses) {
		if (err) {
			writeCount = 0;
			log.error(err);
			disconnect();
			return;
		}
		
		var addressesLen = addresses.length;
		writeCount = addressesLen;
		
		var dataPoints = 0;
		
		for (var a = 0; a < addressesLen; a++) {
			var address = addresses[a];
			
			var btcAddr = address.address;
			
			var dataLen = address.data.length;
			
			dataPoints += dataLen;

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
				}
				writeCount--;
				disconnect();
			});
		}
		
		log.info('Found %d addresses...', addressesLen);
		log.info('Converted %d datapoints...', dataPoints);
		
		disconnect();
	});
});

function disconnect() {
	if (writeCount == 0) {
		mongoose.disconnect();
		log.info('Done.');
		return;
	}
}