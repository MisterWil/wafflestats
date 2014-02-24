var mongoose = require('mongoose');
var Schema = mongoose.Schema;

module.exports = function() {
	var Notification = new Schema({
		address: { type: String, index: true },
		email: { type: String, index: true },
		validated: { type: Boolean, default: false },
		
		settings: {
			hashrate: { type: Boolean, default: false }, 					// Hashrate notifications enabled
			lastHashrateNotification: { type: Date, default: Date.now },	// When the last hashrate notification was sent out
			
			hashrateMinutes: { type: Number, default: 15 },					// How long the hashrate must remain low for a notification to trigger
			fixedThreshold: {type: Boolean, default: false },				// Is the hashrate threshold a fixed number or a percentage of average
			averageDays: { type: Number, default: 1 },						// Number of hours used to calculate hashrate average
			threshold: { type: Number, default: 0.5 },						// Threshold value.
			
			payment: { type: Boolean, default: false }
		}
	});
	
	// Set compound/multifield unique index in mongodb
	Notification.index({
        address : 1,
        email : 1
    }, {
        unique : true
    });
	
	mongoose.model('Notification', Notification);
};