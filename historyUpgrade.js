var express = require('express');
var mongoose = require('mongoose');
var app = express();

var log = require('./log');

//Initialize mongoose schemas
require('./models/models.js').initialize();

app.configure('development', function() {
	mongoose.connect('mongodb://localhost/waffles-dev');
	log.info('Database: waffles-dev');
});

app.configure('production', function() {
	mongoose.connect('mongodb://localhost/waffles');
	log.info('Database: waffles');
});

var Address = mongoose.model('Address');
var History = mongoose.model('History');

var writeCount = 0;

// Dump the history table
History.collection.drop(function (err) {
	
	log.info('Dropped history table...');

	// Upgrade the entire address table, 5 at a time
	var q = Address.find({}).limit(5);
	q.exec(function(err, addresses) {
		if (err) {
			writeCount = 0;
			log.error(err);
			disconnect();
			return;
		}
		
		var addressesLen = addresses.length;
		
		var dataPoints = 0;
		
		for (var a = 0; a < addressesLen; a++) {
			var address = addresses[a];
			
			var btcAddr = address.address;
			
			var dataLen = address.data.length;
			
			dataPoints += dataLen;
			writeCount += dataLen;
			
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
				
				History.create(hist, function (createError) {
					if (createError) {
						log.err(createError);
					}
					
					disconnect();
				});
			}
		}
		
		log.info('Found %d addresses...', addressesLen);
		log.info('Converting %d datapoints...', dataPoints);
	});
});

function disconnect() {
	if (writeCount == 0) {
		mongoose.disconnect();
		log.info('Done.');
		return;
	}
}