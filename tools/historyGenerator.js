var express = require('express');
var mongoose = require('mongoose');
var app = express();

var log = require('../log');

//Initialize mongoose schemas
require('../models/models.js').initialize();

app.configure('development', function() {
	mongoose.connect('mongodb://localhost/waffles-dev');
	log.info('Database: waffles-dev');
});

app.configure('production', function() {
	mongoose.connect('mongodb://localhost/waffles');
	log.info('Database: waffles');
});

var History = mongoose.model('History');

// Generation properties/constants
var btcAddr = 'sine';

var startTime = new Date().getTime() - 1000 * 60 * 60 * 24 * 1; // Subtract (1 second * 60 seconds * 60 minutes * 24 hours * 7 days)
var dataPointScale = 1000 * 60; // One minute
var datapoints = 60*24*1; // 1 per minute, for 24 hours, for 7 days

var multipler = 18; // How quickly the sine curve fluctuates
var height = 1000; //kh/S
var scale = 0.3; // How much higher/lower than the height it can reach where scale of 1 is +- height
var randLow = 1.0; // Randomize end value
var randHigh = 1.0; 

// Remove sine address history
History.remove({address: btcAddr}, function (err) {
	if (err) {
		return log.error(err);
	}
	
	console.log('Dropped any datapoints for address %s...', btcAddr);
	
	var newHistDocs = [];
	
	for (var i = 0; i < datapoints; i++) {
		var dataPointDate = startTime + dataPointScale * i;

		var degrees = i * multipler;
		
		var sineVal = Math.sin(toRadians(degrees));
		
		var scaled = sineVal * scale;
		
		var randomized = scaled * getRandomArbitary(randLow, randHigh);
		
		var heightAdjusted = randomized * height + height;
		
		var hist = {
			address: btcAddr,
			createdAt: new Date(dataPointDate),
			hashRate: heightAdjusted,
			balances: {
				sent: 0.0,
				confirmed: 0.0,
				unconverted: 0.0,
			}
		};
		
		newHistDocs.push(hist);
	}
	
	log.info('Creating %d datapoints for address %s', datapoints, btcAddr);
	
	History.collection.insert(newHistDocs, function (createError, result) {
		if (createError) {
			log.error(createError);
		}
		disconnect();
	});
	
});

function toDegrees (angle) {
	return angle * (180 / Math.PI);
};

function toRadians (angle) {
	return angle * (Math.PI / 180);
};

function getRandomArbitary (min, max) {
	return Math.random() * (max - min) + min;
}

function disconnect() {
	mongoose.disconnect();
	log.info('Done.');
}