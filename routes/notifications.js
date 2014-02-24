var log = require('../log');

var Notifications = require('../plugins/notifications.js');

var mongoose = require('mongoose');
var Notification = mongoose.model('Notification');

module.exports = function(app, rclient) {
	var routes = {};

	routes.get = function(req, res) {
		if (req.params.address != undefined) {
			res.render('notifications', { title: 'WAFFLEStats - Notification Setup', address: req.params.address, error: req.flash('error') });
		} else {
			// TODO: Send error
			res.redirect('/');
		}
	};
	
	routes.post = function(req, res) {
	    setupNotifications(req, res);
	};

	return routes;
};

function setupNotifications(req, res) {
    var address = req.params.address;
    var email = req.body.email;
    
    console.log(address + ' - ' + email);
    
    if (address === undefined) {
        // TODO: Send error
        res.redirect('/');
    } else if (!validateEmail(email)) {
        req.flash('error', 'You must use a valid email address to register for notifications.');
        return res.redirect('/notifications/' + address);
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
    try {
        Notifications.sendSetupEmail(notification);
    } catch (err) {
        log.error(err);
        req.flash('error', 'Sorry about this, but the email system appears to be a hot mess and has failed. Error has been logged.');
        return res.redirect('/notifications/' + notification.address);
    }
}

function validateEmail(email) { 
    var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(email);
} 