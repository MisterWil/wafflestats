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

var addresses = 0;
var dataPoints = 0;
var newHistDocs = [];

//Upgrade the entire address table
var stream = Addresses.find().stream();

stream.on('data', function (address) {
	addresses++;
	
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
	
}).on('error', function (err) {
	log.error(err);
	disconnect();
	
}).on('close', function() {
	log.info('Found %d addresses...', addressesLen);
	log.info('Converting %d datapoints...', dataPoints);
	log.info('Executing create call...');
	
	History.create(newHistDocs, function (createError) {
		if (createError) {
			log.err(createError);
		}
		
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