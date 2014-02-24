var log = require('../log');

var mongoose = require('mongoose');
var History = mongoose.model('History');
var Notification = mongoose.model('Notification');
var Payment = mongoose.model('Payment');

var Hashids = require("hashids"),
hashids = new Hashids(process.env.HASHID);

var jade = require('jade');
var fs = require('fs');

var aws = require('aws-sdk');
aws.config.loadFromPath('./aws-config.json');
var ses = new aws.SES(aws.config);

ses.listVerifiedEmailAddresses(function(err, data) {
    console.log(data);
});

function update(address, data) {
	updatePayouts(address, data);
	checkHashrate(address);
}
exports.update = update;

function sendSetupEmail(notification) {
    var emailTemplate = jade.compile(fs.readFileSync('./views/emails/setup.jade'), 'utf8');
    
    var hashid = hashids.encryptHex(notification._id);
    
    var html = emailTemplate({
        address: notification.address,
        hashid: hashid
    });
    
    console.log(notification.email);
    
    return;
    ses.sendEmail( {
        Source: 'waffles@wilschrader.com',
        Destination: {
            ToAddresses: [notification.email]
        },
        Message: {
            Subject: {
                Data: 'WAFFLEStats Notification Setup'
            },
            Body: {
               Html: {
                   Data: html
               }
            }
        }
    }, function (err, data) {
        if (err) throw err;
        console.log('Email Sent: ');
        console.log(data);
    });
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