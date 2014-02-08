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

var regExp = /^[13][1-9A-HJ-NP-Za-km-z]{26,33}/;

log.info('Testing all addresses for passing given regex...');

History.find().distinct('address', function (err, addresses) {
	if (err) {
		return log.error(err);
	}
	
	var passes = 0;
	var fails = 0;
	
	for (var i = 0; i < addresses.length; i++) {
		var btcAddr = addresses[i]
		
		if (!regExp.test(btcAddr)) {
			log.info('Address \'%s\' failed!', btcAddr);
			fails++;
		} else {
			passes++;
		}
	}
	
	log.info('%d Passed. %d Failed.', passes, fails);
	
	disconnect();
});

function disconnect() {
	mongoose.disconnect();
	log.info('Done.');
}