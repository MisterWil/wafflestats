var log = require('../log');

var mongoose = require('mongoose');
var Address = mongoose.model('Address');

module.exports = function(app, rclient) {
	var routes = {};

	routes.get = function(req, res) {
		if (req.params.address != undefined) {
			Address.findOne({address: req.params.address}, function (err, obj) {
				if (err) {
					return res.send({ error: err });
				}
				
				if (obj === undefined || obj === null) {
					return res.send({ error: 'Address not found' });
				}
				
				// Mask all emails
				if (obj.emails !== undefined) {
					for (var i = 0; i < obj.emails.length; i++) {
						obj.emails[i].masked = hideEmail(obj.emails[i].address);
					}
				}
				
				res.render('notification', { title: 'WAFFLEStats - Notification Setup', address: obj });
			});
		} else {
			// TODO: Send error
			res.redirect('/');
		}
	};

	return routes;
};

function hideEmail(email) {
    var split = email.split('@');
    var username = split[0];
    var domain = split[1];
    
    var regex = /\B[a-zA-Z0-9]/g;
    if (username.length == 1) {
        username = "*";
    } else {
        username = username.replace(regex, "*");
    }
    
    return username + '@' + domain;
}