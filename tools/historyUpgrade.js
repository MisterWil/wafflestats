var express = require('express');
var mongoose = require('mongoose');
var app = express();

var log = require('../log');

//Initialize mongoose schemas
require('../models/models.js').initialize();

log.info('Starting Address->History collection conversion...');

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

var insertsWaitingCallback = 0;

// Dump the history table // commented out so we NEVER DO THIS EVER
//History.collection.drop(function (err) {
	
	log.info('Dropped history table...');
	var addresses = 0;
	var dataPoints = 0;
	var newHistDocs = [];
	
	log.info('Processing address table (could take awhile)...');
	//Upgrade the entire address table
	var stream = Address.find().stream();

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
		log.info('Found %d addresses...', addresses);
		log.info('Converting %d datapoints...', dataPoints);
		log.info('Executing create calls...');
		
		var i, j, tempArray, chunk = 1000, chunkTotal = 0;
		
		for (i = 0, j=newHistDocs.length; i < j; i+= chunk) {
			chunkTotal++;
			tempArray = newHistDocs.slice(i, i+chunk);
			
			insertsWaitingCallback++;
			History.collection.insert(tempArray, function (createError, result) {
				if (createError) {
					log.error(createError);
				}
				insertsWaitingCallback--;
				disconnect();
			});
		}
		
		log.info('Waiting for %d create calls to return...', chunkTotal);
		disconnect();
	});
//});

function disconnect() {
	if (insertsWaitingCallback == 0) {
		mongoose.disconnect();
		log.info('Done.');
	}
}