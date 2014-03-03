var models = ['./Notification.js', './History.js', './Payment.js'];

exports.initialize = function(configuration) {
    var l = models.length;
    for (var i = 0; i < l; i++) {
        require(models[i])(configuration);
    }
};