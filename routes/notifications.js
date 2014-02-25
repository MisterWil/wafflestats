var log = require('../log');
var extend = require("xtend");

var Hashids = require("hashids"),
hashids = new Hashids(process.env.HASHID);

var Notifications = require('../plugins/notifications.js');

var mongoose = require('mongoose');
var Notification = mongoose.model('Notification');

var notificationConfig = {
	hashrateEnabled: false,
	paymentEnabled: false
};

//Regex to test bitcoin addresses before pinging for current data
//Disabled for historical data so I can test locally using historical data
var btcAddressRegex = /^[13][1-9A-HJ-NP-Za-km-z]{26,33}/;

var MAX_AVERAGE_MINUTES = 60;

module.exports = function(app, rclient) {
	var routes = {};
	
	routes.get = function(req, res) {
		if (req.params.address !== undefined) {
			
			var address = req.params.address.trim();
			
			// Regex test
			if (!btcAddressRegex.test(address)) {
				req.flash('error', "Can not create a notification for bitcoin address '"+address+"'. Contact someone about it.");
				return res.redirect('/');
			}
			
			res.render('notifications', {
				title : 'WAFFLEStats - Notifications',
				address : address,
				error : req.flash('error'),
				success : req.flash('success')
			});
		} else {
			res.redirect('/');
		}
	};
	
	routes.post = function(req, res) {
	    setupNotifications(req, res);
	};
	
	routes.config = {};
	
	routes.config.get = function(req, res) {
		if (req.params.hashid !== undefined) {
			var id = Notification.getIdFromHash(req.params.hashid);
			
			Notification.findOneAndUpdate({_id: id}, {validated: true}, function (err, notification) {
				if (err) {
					log.error(err);
					return res.redirect('/');
				}
				
				if (notification) {
					res.render('notificationConfig', {
						title : 'WAFFLEStats - Notification Configuration',
						notification : notification,
						error : req.flash('error'),
						success : req.flash('success')
					});
				} else {
					return res.redirect('/');
				}
			});
		} else {
			res.redirect('/');
		}
	};
	
	routes.config.post = function(req, res) {
		if (req.params.hashid !== undefined) {
			var id = Notification.getIdFromHash(req.params.hashid);
			
			// Since checkboxes don't return false or "off" when unchecked, merge falses in
			var result = req.body;
			result = extend(notificationConfig, result);
			
			result.averageMinutes = Math.max(Math.min(result.averageMinutes, MAX_AVERAGE_MINUTES), 0);
			result.threshold = Math.max(result.threshold, 0);
			
			Notification.findOneAndUpdate({_id: id}, result, function (err, notification) {
				if (err) {
					log.error(err);
					req.flash('error', 'Error saving notification configuration. Error has been logged. Please complain to admin.');
					return res.redirect('/notifications/config/' + req.params.hashid);
				}
				
				req.flash('success', 'Successfully saved notification configuration.');
				return res.redirect('/notifications/config/' + req.params.hashid);
			});
		} else {
			res.redirect('/');
		}
	};
	
	routes.remove = {};
	
	routes.remove.get = function(req, res) {
		if (req.params.hashid !== undefined) {
			var id = Notification.getIdFromHash(req.params.hashid);
			
			Notification.findOneAndUpdate({_id: id}, {validated: true}, function (err, notification) {
				if (err) {
					log.error(err);
					return res.redirect('/');
				}
				
				Notifications.sendRemoveEmail(notification, function (err, response) {
					if (err) {
						log.error(err);
						req.flash('error', 'Sorry, but emails seem to be broken right now. Let us know! We will try and fix it soon!');
			            return res.redirect('/notifications/config/' + notification.getHashId());
					}
					
					req.flash('success', 'An email has been sent to confirm your removal request.');
			        return res.redirect('/notifications/config/' + notification.getHashId());
				});
			});
		} else {
			res.redirect('/');
		}
	};
	
	routes.remove.confirm = {};
	
	routes.remove.confirm.get = function(req, res) {
		if (req.params.hashid !== undefined) {
			var id = Notification.getIdFromHash(req.params.hashid);
			
			Notification.findByIdAndRemove(id, function (err, notification) {
				if (err) {
					log.error(err);
					req.flash('error', 'It seems that we are having issues removing your notification info. Please contact someone!');
					return res.redirect('/');
				}
				
				req.flash('success', 'Your email and notification settings have been removed. Thanks for using WAFFLEStats!');
	            return res.redirect('/');
			});
		} else {
			res.redirect('/');
		}
	};

	return routes;
};

function setupNotifications(req, res) {
    var address = req.params.address;
    var email = req.body.email;
    
    console.log(address + ' - ' + email);
    
    if (address === undefined) {
        return res.redirect('/');
    } else if (!validateEmail(email)) {
        req.flash('error', 'You must use a valid email address to register for notifications.');
        return res.redirect('/notifications/' + address);
    }
    
    address = address.trim();
	
	// Regex test
	if (!btcAddressRegex.test(address)) {
		req.flash('error', "Can not create a notification for bitcoin address '"+address+"'. Contact someone about it.");
		return res.redirect('/');
	}
    
    Notification.findOne({address: address, email: email}, function (err, notification) {
        if (err) {
            log.error(err);
            req.flash('error', 'Sorry about this, but the database seems to have exploded. Error has been logged.');
            return res.redirect('/notifications/' + address);
        }
        
        if (notification) {
            // We've got one that's already at least given us their email. Let's re-send the setup email...
            sendSetupEmail(req, res, notification);
        } else {
            // Let's add them to the database and sent the setup email...
            Notification.create({
                address: address,
                email: email
            }, function (err, notification) {
                if (err) {
                    log.error(err);
                    req.flash('error', 'Sorry about this, but the database seems to have exploded. Error has been logged.');
                    return res.redirect('/notifications/' + address);
                }
                
                sendSetupEmail(req, res, notification);
            });
        }
    });
}

function sendSetupEmail(req, res, notification) {
	Notifications.sendSetupEmail(notification, function (err, response) {
		if (err) {
			log.error(err);
			req.flash('error', 'Sorry, but emails seem to be broken right now. Let us know! We will try and fix it soon!');
            return res.redirect('/notifications/' + notification.address);
		}
		
		req.flash('success', 'An email has been sent with a link to your notification configuration page.');
        return res.redirect('/notifications/' + notification.address);
	});
}

function validateEmail(email) { 
    var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(email);
} 