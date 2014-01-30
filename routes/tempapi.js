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
		// I could work with the result html/json here.  I could also just return it
		console.log("onResult: (" + statusCode + ")" + JSON.stringify(result));
		res.statusCode = statusCode;
		res.send(result);
	});
};