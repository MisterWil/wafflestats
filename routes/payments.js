var log = require('../log');
var extend = require("xtend");

var mongoose = require('mongoose');
var Payment = mongoose.model('Payment');

module.exports = function(app, rclient) {
	var routes = {};

	routes.get = function(req, res) {
		if (req.params.address != undefined) {
			
			Payment.find({address: req.params.address}).sort({time: -1}).exec(function (err, results) {
				if (err) {
					log.error(err);
					return res.send({ error: err });
				}
				
				return res.send(results);
			});
			
		} else {
			res.send({ error: "BTC Address Missing" });
		}
	};
	
	return routes;
};