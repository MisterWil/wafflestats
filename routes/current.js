var rest = require('../plugins/rest');
var log = require('../log');

var mongoose = require('mongoose');
var Address = mongoose.model('Address');

var Collection = require('../plugins/collection.js');
var Fetch = require('../plugins/fetch.js');

module.exports = function(app, rclient) {
	var routes = {};

	routes.temp_api = function(req, res) {
		if (req.params.address != undefined) {

			// Tell the fetch processor to reset the execution time of this
			// address
			Fetch.resetAddress(req.params.address);

/*			// Update the address field with the current date
			Address.update({
				address : req.params.address
			}, {
				$set : {
					lastVisited : Date.now()
				},
				$inc : {
					hitCount : 1
				}
			},
			{
				upsert: true
			},
			function (err, numAffected) {
				if (err) {
					return log.error(err);
				}
			});*/

			Collection.getCurrentData(req.params.address,
					function(err, result) {
						if (err) {
							return res.send({
								error : err
							});
						}

						return res.send(result);
					});

		} else {
			return res.send({
				error : "BTC Address Missing"
			});
		}
	};

	return routes;
};