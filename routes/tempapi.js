var rest = require('../module/rest');
var extend = require("xtend");

var options = {
	host : 'wafflepool.com',
	port : 80,
	path : '/tmp_api',
	method : 'GET',
	headers : {
		'Content-Type' : 'application/json'
	}
};

module.exports = function(app) {
	var routes = {};

	routes.tempapi = function(req, res) {
		if (req.params.address != undefined) {
			options.path = '/tmp_api?address=' + req.params.address;
		}

		rest.getJSON(options, function(statusCode, result) {
			res.statusCode = statusCode;

			// Inject custom version info
			var version = {
				wafflesVersion : app.get('wafflesVersion')
			};
			result = extend(version, result);

			res.send(result);
		});
	};

	return routes;
};