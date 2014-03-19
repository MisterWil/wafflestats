var log = require('../log');
var extend = require("xtend");

var mongoose = require('mongoose');
var History = mongoose.model('History');
var Payment = mongoose.model('Payment');

var SCALE = {
	ONE_MINUTE : {
		value: '1min',
		millis: 1000 * 60
	},
	FIVE_MINUTE: {
		value: '5min',
		millis: 1000 * 60 * 5
	},
	THIRTY_MINUTE: {
		value: '30min',
		millis: 1000 * 60 * 30
	},
	ONE_HOUR: {
		value: '1hr',
		millis: 1000 * 60 * 60
	},
	SIX_HOUR: {
		value: '6hr',
		millis: 1000 * 60 * 60 * 6
	},
	TWELVE_HOUR: {
		value: '12hr',
		millis: 1000 * 60 * 60 * 12
	},
	TWENTYFOUR_HOUR: {
		value: '24hr',
		millis: 1000 * 60 * 60 * 24
	},
	ONE_DAY: {
		value: '1day',
		millis: 1000 * 60 * 60 * 24
	},
	THREE_DAY: {
		value: '3day',
		millis: 1000 * 60 * 60 * 24 * 3
	},
	ONE_WEEK: {
		value: '1wk',
		millis: 1000 * 60 * 60 * 24 * 7
	},
	TWO_WEEK: {
		value: '2wk',
		millis: 1000 * 60 * 60 * 24 * 7 * 2
	}
};

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

var validResolutions = [
	SCALE.FIVE_MINUTE,
	SCALE.THIRTY_MINUTE,
	SCALE.ONE_HOUR, 
	SCALE.ONE_DAY
];

var validRanges = [
	SCALE.ONE_HOUR,
	SCALE.SIX_HOUR,
	SCALE.TWELVE_HOUR,
	SCALE.TWENTYFOUR_HOUR,
	SCALE.ONE_DAY, 
	SCALE.THREE_DAY, 
	SCALE.ONE_WEEK,
	SCALE.TWO_WEEK
];

var invalidWorkerAggregationResolutions = [
	SCALE.ONE_MINUTE,
	SCALE.FIVE_MINUTE,
	SCALE.THIRTY_MINUTE,
];

var rangesAbove = 4, onlyAcceptResolutionsAbove = 2; // If a range is larger than ONE_DAY, only allow resolutions above THIRTY_MINUTE

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
		var resolution = getScale(req.params.resolution.trim());
		var range = getScale(req.params.range.trim());
		
		// Sanity checking
		if (!scaleContains(resolution, validResolutions)) {
			return res.send({ error: "Invalid Resolution", acceptedResolutions: validResolutions, acceptedRanges: validRanges });
		}
		
		if (!scaleContains(range, validRanges)) {
			return res.send({ error: "Invalid Range", acceptedResolutions: validResolutions, acceptedRanges: validRanges });
		}
		
		var resolutionIndex = validResolutions.indexOf(resolution);
		var rangeIndex = validRanges.indexOf(range);
		
		if (rangeIndex > rangesAbove && !(resolutionIndex >= onlyAcceptResolutionsAbove)) {
			return res.send({ error: "Resolution too high for given range.", range: range, acceptedResolutions: validResolutions.slice(onlyAcceptResolutionsAbove) });
		}
		
		
		// Create the date object for how much data to pull
		var fromDate = new Date();
		
		var rangeHours = range.millis / (1000*60*60);
		fromDate.setHours(fromDate.getHours() - rangeHours);
		
		var options = {
				address: btcAddr,
				resolution: resolution,
				fromDate: fromDate,
				includeHashrate: includeHashrate,
				includeBalance: includeBalance
		};
		
		startAggregation(options, function (err, result) {
			if (err) {
				log.error(err);
				return res.send({ error: err });
			}
			
			return res.send(result);
		});
		
	} else {
		res.send({ error: "BTC Address Missing" });
	}
}

function startAggregation(options, callback) {
	// Perform aggregation of global level data
	var globalPipeline = getGlobalAggregatePipeline(options.address, options.resolution, options.fromDate, options.includeHashrate, options.includeBalance);
	var globalAggregation = History.aggregate(globalPipeline);
	
	options["result"] = {};
	
	globalAggregation.exec(function (err, result) {
		if (err) {
			return callback(err, null);
		}
		
		options.result["global"] = result;
		
		if (options.includeHashrate) {
			
			// Bail out of worker aggregation if our resolution is too low... shit gets big yo
			if (scaleContains(options.resolution, invalidWorkerAggregationResolutions)) {
				return callback(null, options.result);
			}
			
			doWorkerAggregation(options, callback);
		} else {
			getPayments(options, callback);
		} 
	});
}

function doWorkerAggregation(options, callback) {
	// Perform aggregation at a worker level
	var workerPipeline = getWorkerAggregatePipeline(options.address, options.resolution, options.fromDate);
	var workerAggregation = History.aggregate(workerPipeline);
	
	workerAggregation.exec(function (err, result) {
		if (err) {
			return callback(err, null);
		}
		
		options.result["workers"] = result;
		
		if (options.includeBalance) {
			getPayments(options, callback);
		} else {
			callback(null, options.result);
		}
	});
}

function getPayments(options, callback) {
	// Return payments
	Payment.find({address: options.address, time: { $gte: options.fromDate}}).sort({time: 1}).exec(function (err, results) {
		if (err) {
			return callback(err, null);
		}
		
		options.result["payments"] = results;
		
		callback(null, options.result);
	});
}

function getGlobalAggregatePipeline(btcAddr, resolution, fromDate, includeHashrate, includeBalance) {
	var groupBy = createGroupById(resolution);

	var sortBy = createSortById(resolution);

	var group = {
		"_id" : groupBy,
		"createdAt" : {
			$min : "$createdAt",
		},
		"count" : {
			$sum : 1
		}
	};
	
	var projection = {
		_id : 0,
		createdAt : 1,
		count : 1
	};

	if (includeHashrate) {
		group["hashrate"] = {
				$avg : "$hashRate"
		};
		projection["hashrate"] = 1;
	}
	
	if (includeBalance) {
		group["sent"] = {
    		$avg: "$balances.sent"
    	};
		
    	group["confirmed"] = {
    		$avg: "$balances.confirmed"
    	};
    	
    	group["unconverted"] = {
            $avg: "$balances.unconverted" 
    	};
    	
    	projection["balances"] = {
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
		$project : projection
	} ];

	return pipeline;
}

function getWorkerAggregatePipeline(btcAddr, resolution, fromDate) {
	var group1_id = createGroupById(resolution);
	
	group1_id["username"] = "$workerHashrates.username";

	var group1 = {
		"_id" : group1_id,
		"createdAt" : {
			$min : "$createdAt",
		},
		"hashrate" : {
			$avg : "$workerHashrates.hashRate"
		}
	};
	
	var group2 = {
		"_id" : "$createdAt",
		"workers" : {
			$addToSet : {
				"_id" : "$_id.username",
				"hashrate" : "$hashrate"
			}
		}
	};
	
	var sortBy = {
			"_id": 1
	};

	var pipeline = [
	    {
			$match : {
				"address" : btcAddr,
				"createdAt" : {
					$gte : fromDate
				}
			}
		}, {
			$unwind: "$workerHashrates"
		}, {
			$group : group1
		}, {
			$group : group2
		}, {
			$sort : sortBy
		}
	];

	return pipeline;
}

function createGroupById(resolution) {
	var id = {
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

	var appendMinutes = false;
	var appendHours = false;

	switch (resolution.value) {
	case SCALE.ONE_MINUTE.value:
	case SCALE.FIVE_MINUTE.value:
	case SCALE.THIRTY_MINUTE.value:
		appendMinutes = true;
	case SCALE.ONE_HOUR.value:
		appendHours = true;
	}

	if (appendHours) {
		id["hour"] = {
			$hour : "$createdAt"
		};
	}

	if (appendMinutes) {
		var resVal = 1;

		if (resolution === FIVE_MINUTE) {
			resVal = 5;
		} else if (resolution === THIRTY_MINUTE) {
			resVal = 30;
		}

		id["minute"] = {
			"$subtract" : [ {
				"$minute" : "$createdAt"
			}, {
				"$mod" : [ {
					"$minute" : "$createdAt"
				}, resVal ]
			} ]
		};
	}

	id["second"] = {
		"$subtract" : [ {
			"$second" : "$createdAt"
		}, {
			"$mod" : [ {
				"$second" : "$createdAt"
			}, 60 ]
		} ]
	};
	
	return id;
}

function createSortById(resolution) {
	var sortBy = {
		"_id.year" : 1,
		"_id.month" : 1,
		"_id.day" : 1
	};

	var appendMinutes = false;
	var appendHours = false;

	switch (resolution.value) {
	case SCALE.ONE_MINUTE.value:
	case SCALE.FIVE_MINUTE.value:
	case SCALE.THIRTY_MINUTE.value:
		appendMinutes = true;
	case SCALE.ONE_HOUR.value:
		appendHours = true;
	}

	if (appendHours) {
		sortBy["_id.hour"] = 1;
	}

	if (appendMinutes) {
		sortBy["_id.minute"] = 1;
	}
	
	sortBy["_id.second"] = 1;
	
	return sortBy;
}

function getScale(stringScale) {
	for(var key in SCALE) {
		if (SCALE[key].value === stringScale) {
			return SCALE[key];
		}
	}
}

function scaleContains(scale, haystack) {
	if (haystack && haystack.length > 0) {
		for (var i = 0; i < haystack.length; i++) {
			if (haystack[i].value === scale.value) {
				return true;
			}
		}
	}
	
	return false;
}