var log = require('../log');
var extend = require("xtend");

var mongoose = require('mongoose');
var History = mongoose.model('History');
var Payment = mongoose.model('Payment');

// Valid resolution and ranges
var ONE_MINUTE = '1min';
var FIVE_MINUTE = '5min';
var THIRTY_MINUTE = '30min';
var ONE_HOUR = '1hr';
var SIX_HOUR = '6hr';
var TWELVE_HOUR = '12hr';
var TWENTYFOUR_HOUR = '24hr';
var ONE_DAY = '1day';
var THREE_DAY = '3day';
var ONE_WEEK = '1wk';
var TWO_WEEK = '2wk';
var ONE_MONTH = '1mo';
var TWO_MONTH = '2mo';

var validResolutions = [FIVE_MINUTE, THIRTY_MINUTE, ONE_HOUR , ONE_DAY];
var validRanges = [ONE_HOUR, SIX_HOUR, TWELVE_HOUR, TWENTYFOUR_HOUR, ONE_DAY, THREE_DAY, ONE_WEEK, TWO_WEEK];

var rangesAbove = 4, onlyAcceptResolutionsAbove = 2; // If a range is larger than ONE_DAY, only allow resolutions above FIVE_MINUTE

module.exports = function(app, rclient) {
	var routes = {};

	routes.get = function(req, res) {
		if (req.params.address != undefined) {
			var where = {
				address : req.params.address
			};

			var fields = {
				'_id' : 0,
				'createdAt' : 1,
				'hashRate' : 1,
				'balances.sent' : 1,
				'balances.confirmed' : 1,
				'balances.unconverted' : 1,
			};
			
			History.find(where, fields, function(err, history) {
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
	
	routes.granularHistory = function(req, res) {
		processAggregation(req, res, true, true);
	};
	
	routes.granularHashRate = function(req, res) {
		processAggregation(req, res, true, false);
	};
	
	routes.granularBalances = function(req, res) {
		processAggregation(req, res, false, true);
	};
	
	return routes;
};

function processAggregation(req, res, includeHashrate, includeBalance) {
	// Setup API path for remote json call
	if (req.params.address != undefined && req.params.resolution != undefined && req.params.range != undefined) {
		
		var btcAddr = req.params.address.trim();
		var resolution = req.params.resolution.trim();
		var range = req.params.range.trim();
		
		if (!arrayContains(resolution, validResolutions)) {
			return res.send({ error: "Invalid Resolution", acceptedResolutions: validResolutions, acceptedRanges: validRanges });
		}
		
		if (!arrayContains(range, validRanges)) {
			return res.send({ error: "Invalid Range", acceptedResolutions: validResolutions, acceptedRanges: validRanges });
		}
		
		var resolutionIndex = validResolutions.indexOf(resolution);
		var rangeIndex = validRanges.indexOf(range);
		
		if (rangeIndex > rangesAbove && !(resolutionIndex >= onlyAcceptResolutionsAbove)) {
			return res.send({ error: "Resolution too high for given range.", range: range, acceptedResolutions: validResolutions.slice(onlyAcceptResolutionsAbove) });
		}
		
		// Create the date object for how much data to pull
		var rangeDate = new Date();
		rangeDate.setHours(rangeDate.getHours() - getHours(range));

		var pipeline = getAggregatePipeline(btcAddr, resolution, rangeDate, includeHashrate, includeBalance);
		var historicalAggregation = History.aggregate(pipeline);
		
		historicalAggregation.exec(function (err, result) {
			if (err) {
				log.error(err);
				return res.send({ error: err });
			}
			
			var historicalData = [].slice.call(result);
			
			if (includeBalance) {
				
				Payment.find({address: btcAddr, time: { $gte: rangeDate}}).sort({time: 1}).exec(function (err, results) {
					if (err) {
						log.error(err);
						return res.send({ error: err });
					}
					
					historicalData.push(results);
					
					return res.send(historicalData);
				});
				
			} else {
				return res.send(historicalData);
			}
			
		});
		
	} else {
		res.send({ error: "BTC Address Missing" });
	}
}

function getAggregatePipeline(btcAddr, resolution, fromDate, includeHashrate,
		includeBalance) {
	var groupBy = {
		"year" : {
			$year : "$createdAt"
		},
		"month" : {
			$month : "$createdAt"
		},
		"day" : {
			$dayOfMonth : "$createdAt"
		}
	};

	var sortBy = {
		"_id.year" : 1,
		"_id.month" : 1,
		"_id.day" : 1
	};

	var appendMinutes = false;
	var appendHours = false;

	switch (resolution) {
	case ONE_MINUTE:
	case FIVE_MINUTE:
	case THIRTY_MINUTE:
		appendMinutes = true;
	case ONE_HOUR:
		appendHours = true;
	}

	if (appendHours) {
		groupBy["hour"] = {
			$hour : "$createdAt"
		};
		sortBy["_id.hour"] = 1;
	}

	if (appendMinutes) {
		var resVal = 1;

		if (resolution === FIVE_MINUTE) {
			resVal = 5;
		} else if (resolution === THIRTY_MINUTE) {
			resVal = 30;
		}

		groupBy["minute"] = {
			"$subtract" : [ {
				"$minute" : "$createdAt"
			}, {
				"$mod" : [ {
					"$minute" : "$createdAt"
				}, resVal ]
			} ]
		};
		sortBy["_id.minute"] = 1;
	}

	groupBy["second"] = {
		"$subtract" : [ {
			"$second" : "$createdAt"
		}, {
			"$mod" : [ {
				"$second" : "$createdAt"
			}, 60 ]
		} ]
	};
	sortBy["_id.second"] = 1;

	var projection = {
		_id : 0,
		createdAt : 1
	};

	var endProjection = {
		_id : 0,
		createdAt : 1,
		count : 1
	};

	var group = {
		"_id" : groupBy,
		"createdAt" : {
			$min : "$createdAt",
		},
		"count" : {
			$sum : 1
		}
	};

	if (includeHashrate) {
		projection["hashRate"] = 1;
		group["hashrate"] = {
				$avg : "$hashRate"
		};
		endProjection["hashrate"] = 1;
	}
	
	if (includeBalance) {
		projection["balances"] = {
				"sent": 1,
				"confirmed": 1,
				"unconverted": 1
		};
		
		group["sent"] = {
    		$avg: "$balances.sent"
    	};
		
    	group["confirmed"] = {
    		$avg: "$balances.confirmed"
    	};
    	
    	group["unconverted"] = {
            $avg: "$balances.unconverted" 
    	};
    	
    	endProjection["balances"] = {
				"sent": "$sent",
				"confirmed": "$confirmed",
				"unconverted": "$unconverted"
		};
	}

	var pipeline = [ {
		$match : {
			"address" : btcAddr,
			"createdAt" : {
				$gte : fromDate
			}
		}
	}, {
		$group : group
	}, {
		$sort : sortBy
	}, {
		$project : endProjection
	} ];
	
	return pipeline;
}

function getHours(range) {
	switch (range) {
	case ONE_HOUR:
		return 1;
	case SIX_HOUR:
		return 6;
	case TWELVE_HOUR:
		return 12;
	case TWENTYFOUR_HOUR:
		return 24;
	case ONE_DAY:
		return 24;
	case THREE_DAY:
		return 24*3;
	case ONE_WEEK:
		return 24*7;
	case TWO_WEEK:
		return 24*7*2;
	case ONE_MONTH:
		return 24*7*4;
	case TWO_MONTH:
		return 24*7*4*2;
	}
	
	return 1;
}

function arrayContains(needle, arrhaystack) {
    return (arrhaystack.indexOf(needle) > -1);
}