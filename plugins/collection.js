var request = require('request');
var log = require('../log');
var extend = require("xtend");

var mongoose = require('mongoose');
var History = mongoose.model('History');

var Notifications = require('./notifications.js');

var app = null;
var rclient = null;

var options = {
	host : 'http://wafflepool.com',
	method: "GET",
	timeout: 10000,
	apiPath : '/tmp_api',
	json: true
};

/*
 * Expire cached data every X seconds. This is to prevent people from pinging
 * the remote API too often by injecting changes into the client side app.
 */
var CURRENT_DATA_EXPIRE_SECONDS = 55;

/*
 * Only store worker data if lastseen is greater than X amount of time ago.
 */
var WORKER_LASTSEEN_LIMIT = 1000 * 60 * 60 * 24 * 7;

function setResources(expressApp, redisClient) {
	app = expressApp;
	rclient = redisClient;
}
exports.setResources = setResources;

/**
 * Attempts to retrieve a cached version of the current data before pinging the API.
 * 
 * @param bitcoinAddress
 * @param callback Of type function (err, result), where result is the json of the cached or current API data
 */
function getCurrentData(bitcoinAddress, callback) {
	if (!app || !rclient) {
		return callback("App or Redis Client Not Set, Server ID10T Error", null);
	}
	
	// Check for a cached value
	rclient.get(bitcoinAddress, function(err, result) {
		if (result) {
			// Send previously cached result
			return callback(null, JSON.parse(result));
		}

		// Otherwise, ping the API to get current data
		getCurrentDataFromAPI(bitcoinAddress, callback);
	});
}
exports.getCurrentData = getCurrentData;

/**
 * Immediately pings the API for the current data and attempts to save it historically.
 * 
 * @param bitcoinAddress
 * @param callback Of type function (err, result), where result is the json of the returned api data
 */
function getCurrentDataFromAPI(bitcoinAddress, callback) {
	if (!app || !rclient) {
		return callback("App or Redis Client Not Set, Server ID10T Error", null);
	}
	
	options.uri = options.host + options.apiPath + '?address=' + bitcoinAddress;

	var req = request(options, function(error, response, body) {
		if (!error && response.statusCode == 200) {
		    processAPIData(bitcoinAddress, body, callback);
		} else {
			if (error) {
				//log.error("Collection.getCurrentDataFromAPI(" + bitcoinAddress + ") Error: " + error);
			} else if (response) {
				//log.error("Collection.getCurrentDataFromAPI(" + bitcoinAddress + ") Failed Response Code: " + response.statusCode);
			}

		    callback("Remote API Unreachable", null);
		}
	});
}
exports.getCurrentDataFromAPI = getCurrentDataFromAPI;

function processAPIData(bitcoinAddress, result, callback) {
	// Inject custom version info, cacheID, and createdAt time
	var inject = {
		wafflesVersion : app.get('wafflesVersion'),
		cacheID : guid(),
		createdAt : new Date()
	};
	result = extend(inject, result);

	// Only cache data if we're not working in dev
	if (app.get('env') !== 'development') {
		cacheResult(bitcoinAddress, result);
	}
	
	// Save the data to the database
	saveHistorical(bitcoinAddress, result);
	
	// Queue the notification processor to run
	setImmediate(Notifications.update(bitcoinAddress, result));

	// Callback with the result
	callback(null, result);
}

function cacheResult(address, result) {
	rclient.set(address, JSON.stringify(result));
	rclient.expire(address, CURRENT_DATA_EXPIRE_SECONDS);
}

function saveHistorical(address, data) {
	if (data !== undefined && data.hash_rate !== undefined) {
		// Parse worker hashrates
		var workerHistory = new Array();
		
		var WORKER_CUTOFF = Date.now() - WORKER_LASTSEEN_LIMIT;
		
		if (data.worker_hashrates) {
			var workerLen = data.worker_hashrates.length;
			
			for (var i = 0; i < workerLen; i++) {
				var workerData = data.worker_hashrates[i];
				
				try {
					var username = workerData.username;
			        var workerHashrate = parseInt(workerData.hashrate);
			        var workerLastSeen = new Date(workerData.last_seen * 1000); // Convert unix time in seconds to milliseconds
			    } catch (err) {
		            return log.error(err);
		        }
			    
			    if (isNaN(workerHashrate)) {
			        log.error("Detected NaN on worker hashrate, ignoring worker");
			        continue;
			    }
			    
			    if (workerLastSeen.getTime() < WORKER_CUTOFF) {
			    	continue;
			    }
			    
			    var workerObj = {
			    		username: username,
			    		hashRate: workerHashrate,
			    		lastSeen: workerLastSeen
			    };
			    
			    workerHistory.push(workerObj);
			}
		}
		
	    try {
	        var hashrate = Number(data.hash_rate);
    	    var sent = Number(data.balances.sent);
    	    var confirmed = Number(data.balances.confirmed);
    	    var unconverted = Number(data.balances.unconverted);
	    } catch (err) {
            return log.error(err);
        }
	    
	    if (isNaN(hashrate) || isNaN(sent) || isNaN(confirmed) || isNaN(unconverted)) {
	        return log.error("Detected NaN, exiting before save.");
	    }
	    
		var hist = {
			address : address,
			hashRate : hashrate,
			workerHashrates: workerHistory,
			balances : {
				sent : sent,
				confirmed : confirmed,
				unconverted : unconverted
			}
		};

		History.create(hist, function(err) {
			if (err) {
				return log.error(err);
			}
		});
	}
}

// Borrowed from http://stackoverflow.com/a/105074
function s4() {
	return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
};

function guid() {
	return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4()
			+ s4() + s4();
}