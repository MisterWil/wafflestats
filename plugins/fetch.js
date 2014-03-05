var log = require('../log');

var mongoose = require('mongoose');
var Address = mongoose.model('Address');

var Collection = require('./collection.js');

var rclient = null;

var MINIMUM_VISIT_DAYS = 3; // The minimum number of days between stats visit for fetching to continue

var ADDRESS_LIST = 'addressList';
var FETCH_QUEUE_MS = 1000 * 5; // 5 minutes

function setRedisClient(redisClient) {
	rclient = redisClient;
}
exports.setRedisClient = setRedisClient;

/**
 * Resets an address such that its new execution time is moved into the future.
 * 
 * @param bitcoinAddress
 */
function resetAddress(bitcoinAddress) {
	if (!rclient) {
		return log.error("Redis client not set.");
	}
	
	rclient.zadd([ADDRESS_LIST, Date.now() + FETCH_QUEUE_MS, bitcoinAddress]);
}
exports.resetAddress = resetAddress;

/**
 * Begins the fetching process.
 */
function start() {
	if (!rclient) {
		return log.error("Redis client not set.");
	}
	
	// Preload the address list with all addresses that have accessed the stats in the last 3 days
	var cutoff = new Date();
	cutoff.setDate(cutoff.getDate() - MINIMUM_VISIT_DAYS);

	Address.find({
		lastVisited : {
			$gte : cutoff
		}
	}, function(err, addresses) {
		if (err) {
			return log.error(err);
		}
		
		if (addresses) {
			var addressesLength = addresses.length;
			
			for (var i = 0; i < addressesLength; i++) {
				var address = addresses[i].address;
				
				rclient.zadd([ADDRESS_LIST, Date.now(), address], function (err, result) {
					if (err) {
						return log.error(err);
					}
					
					console.log("Added Address!");
				});
			}
		}
		
		setImmediate(fetch);
	});
}
exports.start = start;

var fetch = function fetch() {
	rclient.watch(ADDRESS_LIST);
	
	rclient.ZRANGEBYSCORE([ADDRESS_LIST, 0, Date.now(), 'LIMIT', 0, 1], function (err, addresses) {
		if (err) {
			rclient.unwatch(ADDRESS_LIST);
			return log.error(err);
		}
		
		if (addresses && addresses.length == 1) {
			console.log("WOOT");
			updateAddress(addresses[i]);
		} else {
			rclient.unwatch(ADDRESS_LIST);
			console.log("Delaying next process...");
			setTimeout(fetch, 2000); // Larger delay between executions
		}
	});
};

function updateAddress(address) {
	var multiClient = rclient.multi();
	multiClient.zadd([ADDRESS_LIST, Date.now() + FETCH_QUEUE_MS, address]);
	multiClient.exec(function (err, result) {
		if (err) {
			return log.error(err);
		}
		
		console.log("Found address!");
		isAddressFetchable(address, function (err, fetchable) {
			if (fetchable) {
				// Fetch data
				Collection.getCurrentData(address, function (err, result) {
					if (err) {
						return log.error(err);
					}
				});
				
			} else {
				// Address hasn't been actively hit on the client side since before the cutoff, so we can stop fetching it
				rclient.zrem(ADDRESS_LIST, address);
			}
		});

		setImmediate(fetch); // Run immediately
	});
}

function isAddressFetchable(address, callback) {
	Address.findOne({address: address}, 'lastVisited', { lean: true }, function (err, lastVisited) {
		if (err) {
			return callback(err, null);
		}
		
		var cutoff = Date.now() - (1000 * 60 * 60 * 24 * MINIMUM_VISIT_DAYS);
		
		if (lastVisited > cutoff) {
			return callback(err, false);
		}
		
		return callback(err, true);
	});
}