var log = require('../log');

var mongoose = require('mongoose');
var Address = mongoose.model('Address');

module.exports = function(app) {
	var routes = {};

	routes.get = function(req, res) {
		// Setup API path for remote json call
		if (req.params.address != undefined) {
			Address.find({ address: req.params.address }, function(err, address) {
				if (err) {

				}
				res.send(address);
			});
		}
	};
	return routes;
};