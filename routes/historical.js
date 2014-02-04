var log = require('../log');

var mongoose = require('mongoose');
var History = mongoose.model('History');

module.exports = function(app, rclient) {
	var routes = {};

	routes.get = function(req, res) {
		// Setup API path for remote json call
		if (req.params.address != undefined) {
			History.find({ address: req.params.address }, function(err, history) {
				if (err) {
					log.error(err);
					return res.send({ error: "Unknown History Retrieval Error" });
				}
				res.send(history);
			});
		} else {
			res.send({ error: "BTC Address Missing" });
		}
	};
	return routes;
};