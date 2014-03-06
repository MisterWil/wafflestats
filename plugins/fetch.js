var log = require('../log');

var mongoose = require('mongoose');
var Address = mongoose.model('Address');

var Collection = require('./collection.js');

var rclient = null;

var MINIMUM_VISIT_DAYS = 3; // The minimum number of days between stats visit for fetching to continue

var ADDRESS_LIST = 'addressList';
var FETCH_QUEUE_MS = 1000 * 60 * 5; // 5 minutes

var FETCH_EMPTY_QUEUE_TIMEOUT = 20; // 20 milliseconds

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
	
	rclient.zadd([ADDRESS_LIST, Date.now(), bitcoinAddress], function (err, result) {
		if (err) {
			return log.error(err);
		}
	});
}
exports.resetAddress = resetAddress;

/**
 * Begins the fetching process.
 */
function start() {
	if (!rclient) {
		return log.error("Redis client not set.");
	}
	
	/**
	 * If there aren't any addresses in the list, we assume that we're recovering
	 * from a major redis crash, reinstall, error, etc and that we should attempt to rebuild
	 * the fetch queue. Otherwise, we just start watching the queue list.
	 */
	rclient.zcard(ADDRESS_LIST, function (err, count) {
		if (err) {
			return log.error(err);
		}
		
		if (count === 0) {
			fillAddresses();
		}
	});

	setImmediate(fetch);
}
exports.start = start;

var fetch = function fetch() {
	// Watch our list (begin optimistic lock)
	rclient.watch(ADDRESS_LIST);
	
	// Get ONE address that needs to be updated
	rclient.ZRANGEBYSCORE([ADDRESS_LIST, 0, Date.now(), 'LIMIT', 0, 1], function (err, addresses) {
		if (err) {
			log.error(err);
			return resetFetch(true);
		}

		if (addresses && addresses.length === 1) {
			updateAddress(addresses[0]);
		} else {
			resetFetch(false);
		}
	});
};

function resetFetch(instant) {
	rclient.unwatch(); // End optimistic lock
	
	if (instant) {
		setImmediate(fetch);
	} else {
		setTimeout(fetch, FETCH_EMPTY_QUEUE_TIMEOUT);
	}
}

function updateAddress(address) {
	// Begin a multi-execution block which only succeeds if nothing has modified the table we're watching
	var multiClient = rclient.multi();
	
	// Change the address to re-execute in the future
	multiClient.zadd([ADDRESS_LIST, Date.now() + FETCH_QUEUE_MS, address]);
	
	// Execute
	multiClient.exec(function (err, result) {
		if (err) {
			log.error(err);
			return resetFetch(true);
		}
		
		// If !result then the optimistic lock failed and we need to retry immediately
		if (result) {
		    
		    Collection.getCurrentData(address, function (err, result) {
                if (err) {
                    return log.error(err);
                }
            });
			
/*			// Run a check to see if the address we're currently using has accessed their stats in the last 3 days
			isAddressFetchable(address, function (err, fetchable) {
				if (fetchable) {
					Collection.getCurrentData(address, function (err, result) {
						if (err) {
							return log.error(err);
						}
					});
				} else {
					// Address hasn't been actively hit on the client side since before the cutoff, so we can stop fetching it
					rclient.zrem(ADDRESS_LIST, address);
				}
			});*/
		}

		resetFetch(true); // Rerun list instantly
	});
}

function isAddressFetchable(address, callback) {
	Address.findOne({address: address}, 'lastVisited', { lean: true }, function (err, addressObj) {
		if (err) {
			return callback(err, null);
		}
		
		var cutoff = Date.now() - (1000 * 60 * 60 * 24 * MINIMUM_VISIT_DAYS);
		
		if (addressObj && addressObj.lastVisited.getTime() >= cutoff) {
			return callback(err, true);
		}
		
		return callback(err, false);
	});
}

function fillAddresses() {
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
				
				console.log(address);
				
				rclient.zadd([ADDRESS_LIST, Date.now(), address], function (err, result) {
					if (err) {
						return log.error(err);
					}
					
					console.log("Added Address!");
					
					setTimeout(fetch, 2000);
				});
			}
		}
	});
}