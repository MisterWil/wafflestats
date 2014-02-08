var log = require('../log');
var extend = require("xtend");

var mongoose = require('mongoose');
var History = mongoose.model('History');

module.exports = function(app, rclient) {
	var routes = {};

	routes.get = function(req, res) {
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
	
	routes.aggregateTest = function(req, res) {
		// Setup API path for remote json call
		if (req.params.address != undefined) {
			
			var start = new Date();
			History.aggregate(aggregateData(req.params.address, 0, 0, ONE_MINUTE_MILLIS)).exec(function (err, result) {
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

var ONE_SECOND_MILLIS = 1000 * 1;
var ONE_MINUTE_MILLIS = 1000 * 60;
var ONE_HOUR_MILLIS = 1000 * 60 * 60;

// Pulled from http://java.dzone.com/articles/mongodb-time-series?page=0,2

function aggregateData(btcAddr, fromDate, toDate, groupDeltaMillis) {    
    var groupBy = {
        "year" : {
            $year : "$createdAt"
        },
        "dayOfYear" : {
            $dayOfYear : "$createdAt"
        }
    };
     
    var sortBy = {
            "_id.year" : 1,
            "_id.dayOfYear" : 1
    }; 
     
    var appendSeconds = false;
    var appendMinutes = false;
    var appendHours = false;
     
    switch(groupDeltaMillis) {
        case ONE_SECOND_MILLIS :
            appendSeconds = true;          
        case ONE_MINUTE_MILLIS :
            appendMinutes = true;          
        case ONE_HOUR_MILLIS :
            appendHours = true;    
    }  
         
    if(appendHours) {
        groupBy["hour"] = {
            $hour : "$createdAt"  
        };
        sortBy["_id.hour"] = 1;
    }
    if(appendMinutes) {
        groupBy["fiveminute"] = {
        		$mod : [ {$minute : "$createdAt"}, 12] // 12 from 60/5... to get back to minutes... x*5
        };
        sortBy["_id.minute"] = 1;
    }
    if(appendSeconds) {
        groupBy["second"] = {
            $second : "$createdAt"
        };
        sortBy["_id.second"] = 1;
    }  
     
    var pipeline = [
        {
            $match: {
            	"address" : btcAddr
/*                ,"createdAt" : {
                    $gte: fromDate,
                    $lt : toDate   
                }*/
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
                    //"hashRate": {
                    	"avg": {
                            $avg: "$hashRate"
                        },
                        "min": {
                            $min: "$hashRate"
                        },
                        "max": {
                            $max: "$hashRate"
                        }   
                    //}
                    /*"balances" : {
                    	"sent" : {
                    		"avg": {
                                $avg: "$sent"
                            },
                            "min": {
                                $min: "$sent"
                            },
                            "max": {
                                $max: "$sent"
                            }   
                    	},
                    	"confirmed" : {
                    		"avg": {
                                $avg: "$confirmed"
                            },
                            "min": {
                                $min: "$confirmed"
                            },
                            "max": {
                                $max: "$confirmed"
                            }   
                    	},
                    	"unconverted" : {
                    		"avg": {
                                $avg: "$unconverted"
                            },
                            "min": {
                                $min: "$unconverted"
                            },
                            "max": {
                                $max: "$unconverted"
                            }   
                    	}
                    }*/
                }
        },
        {
            $sort: sortBy
        }
    ];
    
    return pipeline;
}