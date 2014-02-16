var rest = require('../plugins/rest');
var log = require('../log');
var extend = require("xtend");

var mongoose = require('mongoose');
var History = mongoose.model('History');

var options = {
	host : 'wafflepool.com',
	port : 80,
	apiPath : '/tmp_api',
	method : 'GET',
	headers : {
		'Content-Type' : 'application/json'
	}
};

/*
 * Expire cached data every X seconds.
 * This is to prevent people from pinging the remote API
 * too often by injecting changes into the client side app.
 */
var expireSeconds = 55;

module.exports = function(app, rclient) {
	var routes = {};

	routes.temp_api = function(req, res) {
		if (req.params.address != undefined) {
			
			// Check if we have a value cached already
			rclient.get(req.params.address, function (err, result) {
				if (result) {
					// Send cached result
					return res.send(JSON.parse(result));
				}
				
				// Ping the API
				retrieveData(req, res);
			});
			
		} else {
			onError(req, res, null, "BTC Address Missing");
		}
	};
	
	function retrieveData(req, res) {
		options.path = options.apiPath + '?address=' + req.params.address;
		
		rest.getJSON(options, function(statusCode, result) {
			res.statusCode = statusCode;
			
			if (statusCode == 200) {
				onSuccess(req, res, result);
			} else {
				onError(req, res, 'HTTP status code: ' + statusCode, "Remote API Unreachable");
			}
		},
		function (err) {
			onError(req, res, err, "Remote API Unreachable");
		});
	}
	
	function onSuccess(req, res, result) {
		// Inject custom version info, cacheID, and createdAt time
		var inject = {
			wafflesVersion : app.get('wafflesVersion'),
			cacheID : guid(),
			createdAt : new Date()
		};
		result = extend(inject, result);
		
		cacheResult(req.params.address, result);
		saveHistorical(req.params.address, result);
		
		res.send(result);
	}

	function onError(req, res, err, errStr) {
		if (err) {
			log.error(err);
		}
		
		res.send({ error: errStr });
	}
	
	function cacheResult(address, result) {
		rclient.set(address, JSON.stringify(result));
		rclient.expire(address, expireSeconds);
	}

	return routes;
};

function saveHistorical(address, data) {
	if (data !== undefined && data.hash_rate !== undefined) {
		var hist = {
				address: address,
				hashRate: parseInt(data.hash_rate),
				balances: {
					sent: parseFloat(data.balances.sent),
					confirmed: parseFloat(data.balances.confirmed),
					unconverted: parseFloat(data.balances.unconverted)
				}
			};
		
		History.create(hist, function (err) {
			if (err) {
				return log.err(err);
			}
		});
	}
}

function s4() {
  return Math.floor((1 + Math.random()) * 0x10000)
             .toString(16)
             .substring(1);
};

function guid() {
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
         s4() + '-' + s4() + s4() + s4();
}