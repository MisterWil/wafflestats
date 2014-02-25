var log = require('../log');

var mongoose = require('mongoose');
var History = mongoose.model('History');
var Notification = mongoose.model('Notification');
var Payment = mongoose.model('Payment');

var jade = require('jade');
var fs = require('fs');

// This was a stupid big where if I didn't pass the config to the new SES instance then
// I would not be connected to the right region. Who the fuck knows why!
var aws = require('aws-sdk');
aws.config.loadFromPath('./aws.json');
var ses = new aws.SES(aws.config);

ses.listVerifiedEmailAddresses(function(err, data) {
    console.log(data);
});

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

				console.log("SEND NOTIFICATION OF PAYOUT - " + payment.txn);
			});
		}
	}
}

function checkHashrate(address) {
	
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