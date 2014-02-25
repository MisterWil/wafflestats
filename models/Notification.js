var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var Hashids = require("hashids"),
hashids = new Hashids(process.env.HASHID);

module.exports = function() {
	var Notification = new Schema({
		address: { type: String, index: true },
		email: { type: String, index: true },
		validated: { type: Boolean, default: false, index: true },
		
		lastHashrateNotification: { type: Date, default: Date.now, index: true },	// When the last hashrate notification was sent out
			
		hashrateEnabled: { type: Boolean, default: false, index: true }, 			// Hashrate notifications enabled
		averageMinutes: { type: Number, default: 5 },					// How long the hashrate must remain low for a notification to trigger
		threshold: { type: Number, default: 0 },						// Hashrate threshold
			
		paymentEnabled: { type: Boolean, default: false, index: true }
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