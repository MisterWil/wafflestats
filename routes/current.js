var rest = require('../plugins/rest');
var log = require('../log');
var extend = require("xtend");

var mongoose = require('mongoose');
var Address = mongoose.model('Address');

var options = {
	host : 'wafflepool.com',
	port : 80,
	apiPath : '/tmp_api',
	method : 'GET',
	headers : {
		'Content-Type' : 'application/json'
	}
};

module.exports = function(app) {
	var routes = {};

	routes.temp_api = function(req, res) {
		// Setup API path for remote json call
		if (req.params.address != undefined) {
			options.path = options.apiPath + '?address=' + req.params.address;
		} else {
			options.path = options.apiPath;
		}

		// Retrieve the data
		rest.getJSON(options, function(statusCode, result) {
			res.statusCode = statusCode;
			
			if (statusCode == 200) {
				onSuccess(req, res, result);
			} else {
				onError(req, res, 'API Returned Status Code: ' + statusCode);
			}
		},
		function (err) {
			onError(req, res, err);
		});
	};
	
	function onSuccess(req, res, result) {
		// Inject custom version info
		var version = {
			wafflesVersion : app.get('wafflesVersion')
		};
		result = extend(version, result);
		
		saveHistorical(req.params.address, result);

		res.send(result);
	}

	function onError(req, res, err) {
		log.error(err);
		res.send({ error: "Failed to call remote API!" });
	}

	return routes;
};

function saveHistorical(address, data) {
	if (data !== undefined && data.hash_rate !== undefined) {
		var dataArray = {
				wafflesVersion: data.wafflesVersion,
				hashRate: parseInt(data.hash_rate),
				balances: {
					sent: parseFloat(data.balances.sent),
					confirmed: parseFloat(data.balances.confirmed),
					unconverted: parseFloat(data.balances.unconverted)
				}
		}
	
		Address.update({
			address : address
		}, {
			$pushAll : {
				data : [dataArray]
			}
		}, {
			upsert : true
		}, function(err) {
			if (err) {
				log.error(err);
			}
		});
	}
}