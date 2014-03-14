var log = require('../log');
var extend = require("xtend");

var mongoose = require('mongoose');
var History = mongoose.model('History');
var Payment = mongoose.model('Payment');

// Valid ranges
var ONE_HOUR = '1hr';
var SIX_HOUR = '6hr';
var TWELVE_HOUR = '12hr';
var TWENTYFOUR_HOUR = '24hr';
var THREE_DAY = '3day';
var ONE_WEEK = '7day';
var LIFETIME = 'lifetime';

var validRanges = [ONE_HOUR, SIX_HOUR, TWELVE_HOUR, TWENTYFOUR_HOUR, THREE_DAY, ONE_WEEK, LIFETIME];

module.exports = function(app, rclient) {
	var routes = {};
	
	routes.get = function(req, res) {
		processAggregation(req, res);
	};
	
	return routes;
};

function processAggregation(req, res) {
	// Setup API path for remote json call
	if (req.params.address != undefined && req.params.range != undefined) {
		
		var btcAddr = req.params.address.trim();
		var range = req.params.range.trim();

		if (!arrayContains(range, validRanges)) {
			return res.send({ error: "Invalid Range", acceptedRanges: validRanges });
		}
		
		// Create the date object for how much data to pull
		var rangeDate = null;
		
		if (range !== LIFETIME) {
			rangeDate = new Date();
			rangeDate.setHours(rangeDate.getHours() - getHours(range));
		}

		var pipeline = getAggregatePipeline(btcAddr, rangeDate);
		var historicalAggregation = History.aggregate(pipeline);
		
		historicalAggregation.exec(function (err, result) {
			if (err) {
				log.error(err);
				return res.send({ error: err });
			}
			
			if (!result || result.length == 0) {
				return res.send({ error: "Unable to find data!" });
			}
			
			var hashrateData = result[0];
			
			var match = {
					"address" : btcAddr
			};
			
			if (rangeDate) {
				match["createdAt"] = {
						$gte : rangeDate
				};
			}
			
			// Get minimum record
			History.find(match).sort({createdAt: 1}).limit(1).exec(function(err, minResults) {
				if (err) {
					log.error(err);
					return res.send({ error: err });
				}
				
				if (!minResults || minResults.length == 0) {
					return res.send({ error: "Unable to find data!" });
				}
				
				var minData = minResults[0];
				
				// Get maximum record
				History.find(match).sort({createdAt: -1}).limit(1).exec(function(err, maxResults) {
					if (err) {
						log.error(err);
						return res.send({ error: err });
					}
					
					if (!maxResults || maxResults.length == 0) {
						return res.send({ error: "Unable to find data!" });
					}
					
					var maxData = maxResults[0];
					
					var maxDate = new Date(maxData.createdAt);
					var minDate = new Date(minData.createdAt);
					var hours = Math.abs(maxDate - minDate) / (1000*60*60); // Hours between two dates

					var maxEarned = (maxData.balances.sent + maxData.balances.confirmed + maxData.balances.unconverted);
					var minEarned = (minData.balances.sent + minData.balances.confirmed + minData.balances.unconverted);
					var earnedOverPeriod = Math.abs(maxEarned - minEarned);
					
					var btcPerHour = earnedOverPeriod / hours;
					
					//Hour add BTC / Hour Average Hashrate * 24
					var btcPerDay = btcPerHour * 24;
					
					var btcPerDayPerMhash = btcPerDay / hashrateData.avgHashrate * 1000000;
					
					var statistics = {
							success: true,
							avgHashrate: hashrateData.avgHashrate,
							minHashrate: hashrateData.minHashrate,
							maxHashrate: hashrateData.maxHashrate,
							totalEarned: earnedOverPeriod,
							btcPerHour: btcPerHour,
							btcPerDay: btcPerDay,
							btcPerDayPerMhash: btcPerDayPerMhash
					};
					
					res.send(statistics);
					
				});
			});
		});
		
	} else {
		res.send({ error: "BTC Address Missing" });
	}
}

function getAggregatePipeline(btcAddr, fromDate) {
	var match = {
			"address" : btcAddr
	};
	
	if (fromDate) {
		match["createdAt"] = {
				$gte : fromDate
		};
	}

	var pipeline = [ {
		$match : match
	}, {
		$group : {
			"_id" : 1,
	         "avgHashrate":{
	            "$avg":"$hashRate"
	         },
	         "minHashrate":{
		        "$min":"$hashRate"
		     },
		     "maxHashrate":{
			    "$max":"$hashRate"
			 }
		}
	}];
	
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
	case THREE_DAY:
		return 24*3;
	case ONE_WEEK:
		return 24*7;
	}
	
	return 1;
}

function arrayContains(needle, arrhaystack) {
    return (arrhaystack.indexOf(needle) > -1);
}