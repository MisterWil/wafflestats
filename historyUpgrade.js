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

// Dump the history table
History.collection.drop(function (err) {
	
	log.info('Dropped history table...');

	// Upgrade the entire address table
	var q = Address.find({});
	q.exec(function(err, addresses) {
		if (err) {
			log.error(err);
			disconnect();
			return;
		}
		
		var addressesLen = addresses.length;
		
		var dataPoints = 0;
		var newHistDocs = [];
		
		for (var a = 0; a < addressesLen; a++) {
			var address = addresses[a];
			
			var btcAddr = address.address;
			
			var dataLen = address.data.length;
			
			dataPoints += dataLen;
			
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
		}
		
		log.info('Found %d addresses...', addressesLen);
		log.info('Converting %d datapoints...', dataPoints);
		log.info('Executing create call...');
		
		History.create(newHistDocs, function (createError) {
			if (createError) {
				log.err(createError);
			}

			disconnect();
		});
	})
});

function disconnect() {
	if (writeCount == 0) {
		mongoose.disconnect();
		log.info('Done.');
		return;
	}
}