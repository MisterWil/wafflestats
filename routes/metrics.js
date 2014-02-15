var log = require('../log');
var extend = require("xtend");

var mongoose = require('mongoose');
var History = mongoose.model('History');

var METRICS = 'metrics';
var expireSeconds = 600; // 10 minutes

module.exports = function(app, rclient) {
    var routes = {};

    routes.get = function(req, res) {

        // Check if we have cached metrics since this is an "expensive" operation
        rclient.get(METRICS, function(err, metrics) {
            if (metrics) {
                // Send cached metrics
                return res.send(JSON.parse(metrics));
            }

            // Otherwise, update the metrics and cache them
            getMetrics(function(err, metrics) {
                if (err) {
                    return res.send({
                        error : err
                    });
                }
                
                cacheMetrics(metrics);
                return res.send(metrics);
            });
        });
    };
    
    function cacheMetrics(metrics) {
        rclient.set(METRICS, JSON.stringify(metrics));
        rclient.expire(METRICS, expireSeconds);
    }

    return routes;
};

function getMetrics(callback) {
	var aggregateData = {};
	
	// Get collection statistics directly from mongodb
	History.collection.stats(function (err, results) {
	    if (err) {
            return callback(err, null);
        }
	    
	    aggregateData.stats = results;
    	
    	// Get unique addresses
    	History.aggregate(uniqueAddressesPipeline).exec(function (err, result) {
    		if (err) {
    			return callback(err, null);
    		}
    		
    		aggregateData.uniqueAddresses = result[0].uniqueAddresses;
    		
    		// Get lifetime aggregates
    		History.aggregate(aggregateVals(new Date(0))).exec(function (err, result) {
    			if (err) {
    				return callback(err, null);
    			}
    			
    			aggregateData.lifetime = result[0];
    			
    			// Get last 24 hour aggregates
    			var fromDate = new Date();
    			fromDate.setHours(fromDate.getHours() - 24);
    
    			History.aggregate(aggregateVals(fromDate)).exec(function (err, result) {
    				if (err) {
    					return callback(err, null);
    				}
    				
    				aggregateData.last24 = result[0];
    				
    				callback(null, aggregateData);
    			});
    		});
    	});
	});
}

// select count(distinct addresses) from history
var uniqueAddressesPipeline = [ {
	$group : {
		_id : "$address"
	}
}, {
	$group : {
		_id: 1,
		uniqueAddresses : {
			$sum : 1
		}
	}
}, {
	$project : {
		_id: 0,
		uniqueAddresses : 1
	}
} ];

function aggregateVals(date) {
	return [ {
		$match : {
			"createdAt" : {
				$gte : date
			}
		}
	}, {
		$group : {
			_id : 1,
			oldestDatapoint : {
				$first : "$createdAt"
			},
			newestDatapoint : {
				$last : "$createdAt"
			},
			totalDatapoints : {
				$sum : 1
			},
			averageHashrate : {
				$avg : "$hashRate"
			},
			maximumHashrate : {
				$max : "$hashRate"
			},
			averageSent : {
				$avg : "$balances.sent"
			},
			maximumSent : {
				$max : "$balances.sent"
			},
			averageConfirmed : {
				$avg : "$balances.confirmed"
			},
			maximumConfirmed : {
				$max : "$balances.confirmed"
			},
			averageUnconverted : {
				$avg : "$balances.unconverted"
			},
			maximumUnconverted : {
				$max : "$balances.unconverted"
			}
		}
	}, {
		$project : {
			_id : 0,
			oldestDatapoint : 1,
			newestDatapoint : 1,
			totalDatapoints : 1,
			averageHashrate : 1,
			maximumHashrate : 1,
			averageSent : 1,
			maximumSent : 1,
			averageConfirmed : 1,
			maximumConfirmed : 1,
			averageUnconverted : 1,
			maximumUnconverted : 1
		}
	} ];
}
