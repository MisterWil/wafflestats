var log = require('../log');
var extend = require("xtend");

var mongoose = require('mongoose');
var History = mongoose.model('History');

// Valid resolution and ranges
var ONE_MINUTE = '1min';
var FIVE_MINUTE = '5min';
var ONE_HOUR = '1hr';
var SIX_HOUR = '6hr';
var TWELVE_HOUR = '12hr';
var TWENTYFOUR_HOUR = '24hr';
var ONE_DAY = '1day';
var ONE_WEEK = '1wk';
var ONE_MONTH = '1mo';
var TWO_MONTH = '2mo';

var validResolutions = [ONE_MINUTE, FIVE_MINUTE, ONE_HOUR, ONE_DAY];
var validRanges = [ONE_HOUR, SIX_HOUR, TWELVE_HOUR, TWENTYFOUR_HOUR, ONE_DAY, ONE_WEEK, ONE_MONTH];

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
			}
			
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
	
	routes.granularity = function(req, res) {
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
			
			var start = new Date();
			
			var pipeline = createAggregatePipeline(btcAddr, resolution, rangeDate);
			var aggregateQuery = History.aggregate(pipeline);
			
			aggregateQuery.exec(function (err, result) {
				if (err) {
					log.error(err);
					return res.send({ error: err });
				}
				
				var aggregationDuration = new Date().getTime() - start.getTime()
				
				var inject = {
					wafflesVersion : app.get('wafflesVersion'),
					durationMillis : aggregationDuration
				};
				result = extend(inject, result);
					
				res.send(result);
				
			});
			
		} else {
			res.send({ error: "BTC Address Missing" });
		}
	};
	
	return routes;
};

function createAggregatePipeline(btcAddr, resolution, fromDate) {
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
	
	var minuteModVal;
	
	switch(resolution) {
	case ONE_MINUTE:
	case FIVE_MINUTE:
		appendMinutes = true;
	case ONE_HOUR:
		appendHours = true;
	}
	
	if(appendHours) {
        groupBy["hour"] = {
            $hour : "$createdAt"  
        };
        sortBy["_id.hour"] = 1;
    }
	
    if(appendMinutes) {
    	var mod = 60;
    	
    	if (resolution === FIVE_MINUTE) {
    		mod = 60/5; // Get back to minutes using min * 5
    	}
    	
        groupBy[resolution] = {
        		$mod : [ {$minute : "$createdAt"}, mod]
        };
        sortBy["_id." + resolution] = 1;
    }
    
    var pipeline = [
        {
            $match: {
            	"address" : btcAddr,
            	"createdAt" : { $gte: fromDate }
            }
        },
        {
            $project: {
                _id : 0,
                createdAt : 1,
                hashRate : 1,
        		balances: {
        			sent: 1,
        			confirmed: 1,
        			unconverted: 1,
        		}
            }
        },
        {
            $group: {
                    "_id": groupBy,
                    "count": {
                        $sum: 1
                    },
                    "hashRate": {
                    	$avg: "$hashRate"
                    },
                	"sent" : {
                		$avg: "$sent"
                	},
                	"confirmed" : {
                		$avg: "$confirmed"
                	},
                	"unconverted" : {
                        $avg: "$unconverted" 
                	}
                }
        },
        {
            $sort: sortBy
        }
    ];
    
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
	case ONE_WEEK:
		return 24*7;
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