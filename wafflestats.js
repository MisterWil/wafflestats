// Node Modules
var fs = require('fs');
var path = require('path');

// Load config file
var configFile = "./configs/default.json";
if (process.env.CONFIG !== undefined) {
	configFile = process.env.CONFIG;
} else {
	console.log("Warning! Using './configs/default.json' config file.");
}

var config = null;
try {
	config = JSON.parse(fs.readFileSync(configFile));
} catch (err) {
	console.log("Err when loading config file: " + err.stack);
	process.exit(1);
}

if (!config) {
	console.log("Unable to process config file: " + configFile);
	process.exit(1);
}

// Express & Web Modules
var express = require('express');
var app = express();
var http = require('http');
var flash = require('connect-flash');

// Mongoose (MongoDB)
var mongoose = require('mongoose');
mongoose.connect(config.mongo.address);

// Setup Mongoose Models
require('./models/models.js').initialize(config);

// Redis
var redis = require("redis");
var RedisStore = require('connect-redis')(express);
var rclient = redis.createClient(config.redis.port, config.redis.address);

// Pass config to notifications for AWS setup
require('./plugins/notifications.js').setAwsConfig(config.aws);

// Pass redis client to notifications
require('./plugins/notifications.js').setRedisClient(rclient);

if ('development' == app.get('env')) {
	app.use(express.logger('dev'));
	app.use(express.errorHandler());
	app.locals.pretty = true;
}

// Set resources for collection
require('./plugins/collection.js').setResources(app, rclient);

// Fetch plugin
var Fetch = require('./plugins/fetch.js');
Fetch.setRedisClient(rclient);

// Setup routes
var index = require('./routes/index')();
var current = require('./routes/current')(app, rclient);
var historical = require('./routes/historical')(app, rclient);
var historicalv2 = require('./routes/historical_v2')(app, rclient);
var metrics = require('./routes/metrics')(app, rclient);
var notifications = require('./routes/notifications')(app, rclient);
var payments = require('./routes/payments')(app, rclient);
var statistics = require('./routes/statistics')(app, rclient);

// Waffles Version Info
app.set('wafflesVersion', '1.1');

// Flash!
app.use(express.cookieParser());
app.use(express.session({ store: new RedisStore({ client: rclient }), secret: config.hashid }));
//app.use(express.session({secret: config.hashid}));
app.use(flash());

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// Setup routes
app.get('/', index.get);
app.get('/stats', index.stats);

app.get('/template', function (req, res) {
    res.render('emails/setup', { title: 'WAFFLEStats' });
});

app.get('/current/:address', current.temp_api);
app.get('/historical/:address/:resolution/:range', historical.granularHistory);
app.get('/historical/hashRate/:address/:resolution/:range', historical.granularHashRate);
app.get('/historical/balances/:address/:resolution/:range', historical.granularBalances);

app.get('/historical/v2/:address/:resolution/:range', historicalv2.granularHistory);
app.get('/historical/v2/hashRate/:address/:resolution/:range', historicalv2.granularHashRate);
app.get('/historical/v2/balances/:address/:resolution/:range', historicalv2.granularBalances);

app.get('/notifications/:address', notifications.get);
app.post('/notifications/:address', notifications.post);

app.get('/notifications/config/:hashid', notifications.config.get);
app.post('/notifications/config/:hashid', notifications.config.post);

app.get('/notifications/remove/:hashid', notifications.remove.get);
app.get('/notifications/remove/confirm/:hashid', notifications.remove.confirm.get);

app.get('/payments/:address', payments.get);

app.get('/statistics/:address/:range', statistics.get);

app.get('/metrics', metrics.get);

// Backwards compatibility
app.get('/temp-api/:address', current.temp_api);
app.get('/historical/:address', historical.get);

// Create the server
http.createServer(app).listen(app.get('port'), function(){
  console.log(
          'Express server listening on port %d within %s environment',
          app.get('port'), app.get('env')
      );
});

// Start background fetching
Fetch.start();
