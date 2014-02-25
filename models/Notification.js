var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var Hashids = require("hashids"),
hashids = new Hashids(process.env.HASHID);

module.exports = function() {
	var Notification = new Schema({
		address: { type: String, index: true },
		email: { type: String, index: true },
		validated: { type: Boolean, default: false },
		
		lastHashrateNotification: { type: Date, default: Date.now },	// When the last hashrate notification was sent out
			
		hashrateEnabled: { type: Boolean, default: false }, 			// Hashrate notifications enabled
		averageDays: { type: Number, default: 1 },						// Number of hours used to calculate hashrate average
		averageMinutes: { type: Number, default: 15 },					// How long the hashrate must remain low for a notification to trigger
		percentThreshold: { type: Number, default: 0.5 },				// Percentage difference to trigger notification
			
		paymentEnabled: { type: Boolean, default: false }
	});
	
	Notification.methods.getHashId = function getHashId() {
		return hashids.encryptHex(this._id);
	}
	
	Notification.statics.getIdFromHash = function getIdFromHash(hashId) {
		return hashids.decryptHex(hashId);
	}
	
	// Set compound/multifield unique index in mongodb
	Notification.index({
        address : 1,
        email : 1
    }, {
        unique : true
    });
	
	mongoose.model('Notification', Notification);
};