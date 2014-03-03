var log = require('../log');
var sprintf = require('sprintf').sprintf;

var mongoose = require('mongoose');
var History = mongoose.model('History');
var Notification = mongoose.model('Notification');
var Payment = mongoose.model('Payment');

var jade = require('jade');
var fs = require('fs');

// This was a stupid big where if I didn't pass the config to the new SES instance then
// I would not be connected to the right region. Who the fuck knows why!
var aws = require('aws-sdk');
var ses = new aws.SES();

var HASHRATE_EMAIL_MINUTES = 60; // Only send a hashrate notification email every 60 minutes

// Only accept hashRate averages if we have at least 80% of the number of points that happen in the timeframe.
// Example: To report on a low hashrate over 10 minutes, we need at least 8 points.
var HASHRATE_MIN_POINT_PERCENT = 0.8;

function setAwsConfig(config) {
	aws.config = new aws.Config(config);
	ses = new aws.SES(aws.config);
	
	ses.listVerifiedEmailAddresses(function(err, data) {
	    if (!data) {
	    	console.log("List Verified SES Email Addresses FAILED! Did you configure your AWS settings in ./configs?");
	    } else {
	    	console.log(data);
	    }
	});
}
exports.setAwsConfig = setAwsConfig;

function update(address, data) {
	updatePayouts(address, data);
	checkHashrate(address);
}
exports.update = update;

function sendSetupEmail(notification, callback) {
	try {
	    var hashid = notification.getHashId();
	    
	    var emailTemplate = getTemplate('emails/setup.jade');
	    var html = emailTemplate({
	        address: notification.address,
	        hashid: hashid
	    });
	    
	    sendEmail(notification.email, 'WAFFLEStats Notification Setup', html, callback);
	} catch (err) {
		callback(err, null);
	}
}
exports.sendSetupEmail = sendSetupEmail;

function sendRemoveEmail(notification, callback) {
	try {
	    var hashid = notification.getHashId();
	    
	    var emailTemplate = getTemplate('emails/remove.jade');
	    var html = emailTemplate({
	        hashid: hashid
	    });
	    
	    sendEmail(notification.email, 'WAFFLEStats Notification Removal', html, callback);
	} catch (err) {
		callback(err, null);
	}
}
exports.sendRemoveEmail = sendRemoveEmail;

function sendPaymentEmails(payment, callback) {
	try {
	    var emailTemplate = getTemplate('emails/payment.jade');
	    
	    Notification.find({address: payment.address, validated: true, paymentEnabled: true}, function (err, notifications) {
	    	if (err) {
	    		return callback(err, null);
	    	}
	    	
	    	if (notifications) {
		    	var notificationsLen = notifications.length;
		    	for (var i = 0; i < notificationsLen; i++) {
		    		var html = emailTemplate({
		    			hashid: notifications[i].getHashId(),
		    	        address: payment.address,
		    	        txn: payment.txn,
		    	        amount: payment.amount,
		    	        time: payment.time
		    	    });
		    		
		    		sendEmail(notifications[i].email, 'WAFFLEStats Payment Notification', html, callback);
		    	}
	    	}
	    });
	    
	} catch (err) {
		callback(err, null);
	}
}

function sendHashrateEmail(notification, hashRate, callback) {
	try {
	    var emailTemplate = getTemplate('emails/hashrate.jade');
	    
	    var html = emailTemplate({
	    	hashid: notification.getHashId(),
	        averageMinutes: notification.averageMinutes,
	        averageMinutesHashrate: sprintf("%.2f kH/s", hashRate),
	        threshold: sprintf("%.2f kH/s", notification.threshold)
	    });

		sendEmail(notification.email, 'WAFFLEStats Hashrate Notification', html, callback);

	} catch (err) {
		callback(err, null);
	}
}

function updatePayouts(address, data) {
	if (data !== undefined && data.recent_payments !== undefined) {
		var paymentsLength = data.recent_payments.length;

		// For every payment in the data object attempt to save the payment details
		for ( var i = 0; i < paymentsLength; i++) {
			var paymentData = data.recent_payments[i];
			
			var payment = new Payment({
			    address: address,
				txn : paymentData.txn,
				amount : paymentData.amount,
				time : new Date(paymentData.time)
			});

			payment.save(function(err, payment) {
				if (err) {
				    // Eat the error, as we likely hit a unique constraint (which is good)
					return;
				}

				sendPaymentEmails(payment, function (err, data) {
					if (err) {
						return log.error(err);
					}
				});
			});
		}
	}
}

function checkHashrate(address) {
	var notificationDate = new Date();
	notificationDate.setMinutes(notificationDate.getMinutes() - HASHRATE_EMAIL_MINUTES);
	notificationDate.setSeconds(0);
	
	Notification.find({
		address : address,
		validated : true,
		hashrateEnabled : true,
		lastHashrateNotification: { $lt: notificationDate }
	}, function(err, notifications) {
		if (err) {
			log.error(err);
			return res.send(err);
		}
		
		if (notifications) {
			var notificationsLen = notifications.length;
			
			for (var i = 0; i < notificationsLen; i++) {
				var notification = notifications[i];
				
				var rangeDate = new Date();
				rangeDate.setMinutes(rangeDate.getMinutes() - notification.averageMinutes);
				rangeDate.setSeconds(0);
				
				var pipeline = getHashRateAggregatePipeline(notification.address, rangeDate);
				var aggregateQuery = History.aggregate(pipeline);

				aggregateQuery.exec(function (err, result) {
					if (err) {
						log.error(err);
						return;
					}

					if (result && result.length > 0) {
						var average = result[0];

						// Convert to kHash/second
						var hashRate = average.hashRate / 1000;
						
						// Only accept hashRate averages if we have at least 80% of the number of points
						// that happen in the given timeframe.
						var minimumCount = notification.averageMinutes * HASHRATE_MIN_POINT_PERCENT;

						if (average.count >= minimumCount && hashRate < notification.threshold) {
							sendHashrateEmail(notification, hashRate, function (err, data) {
								if (err) {
									return log.error(err);
								}
								
								notification.update({lastHashrateNotification: Date.now()}, function (err, data) {
									if (err) {
										return log.error(err);
									}
								});
							});
						}
					}
					
				});
			}
		}
	});
}

function getHashRateAggregatePipeline(btcAddr, fromDate) {
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
                hashRate : 1
            }
        },
        {
            $group: {
                    "_id": "1",
                    "count": {
                        $sum: 1
                    },
                    "hashRate": {
                    	$avg: "$hashRate"
                    }
                }
        }
    ];
    
    return pipeline;
}

function getTemplate(template) {
	return jade.compile(fs.readFileSync('./views/' + template), {
		filename: './views/' + template
	});
}

function sendEmail(toEmail, subject, html, callback) {
	ses.sendEmail( {
        Source: 'waffles@wilschrader.com',
        Destination: {
            ToAddresses: [toEmail]
        },
        Message: {
            Subject: {
                Data: subject
            },
            Body: {
               Html: {
                   Data: html
               }
            }
        }
    }, function (err, data) {
    	if (err) {
    		return callback(err, null);
    	}

    	callback(null, data);
    });
}