var rest = require('../module/rest');

var options = {
    host: 'wafflepool.com',
    port: 80,
    path: '/tmp_api',
    method: 'GET',
    headers: {
        'Content-Type': 'application/json'
    }
};

exports.tempapi = function(req, res) {
	if (req.params.address != undefined) {
		options.path = '/tmp_api?address=' + req.params.address;
	}
	
	rest.getJSON(options, function(statusCode, result) {
		res.statusCode = statusCode;
		res.send(result);
	});
};