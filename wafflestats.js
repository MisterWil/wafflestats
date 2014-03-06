// Require modules without configuration
var flash = require('connect-flash');
var express = require('express');
var app = express();
var http = require('http');
var path = require('path');
var fs = require('fs');

var mongoose = require('mongoose');

var redis = require("redis");
var RedisStore = require('connect-redis')(express);
var rclient = null;

// Setup configuration file
var configFile = "./configs/default.json";
if (process.env.CONFIG !== undefined) {
	configFile = process.env.CONFIG;
}

var configuration = null;
try {
	configuration = JSON.parse(fs.readFileSync(configFile));
} catch (err) {
	console.log("Err when loading config file: " + err.stack);
	process.exit(1);
}

if (!configuration) {
	console.log("Unable to process configuration file: " + configFile);
	process.exit(1);
}

// Setup models
require('./models/models.js').initialize(configuration);

// Setup AWS
require('./plugins/notifications.js').setAwsConfig(configuration.aws);

// Set up specific environments
app.configure('development', function() {
    app.use(express.logger('dev'));
	app.use(express.errorHandler());
	app.locals.pretty = true;
	mongoose.connect(configuration.development.mongo.address);
	rclient = redis.createClient(configuration.development.redis.port, configuration.development.redis.address);
});

rclient = redis.createClient(configuration.production.redis.port, configuration.production.redis.address);

if (!rclient) {
	console.log("Redis client not found...");
	process.exit(1);
}

// Set resources
require('./plugins/collection.js').setResources(app, rclient);

// Set up fetch
var Fetch = require('./plugins/fetch.js');
Fetch.setRedisClient(rclient);

// Setup routes
var index = require('./routes/index')();
var current = require('./routes/current')(app, rclient);
var historical = require('./routes/historical')(app, rclient);
var metrics = require('./routes/metrics')(app, rclient);

var notifications = require('./routes/notifications')(app, rclient);

app.configure(function() {
	// Waffles Version Info
	app.set('wafflesVersion', '0.8');
	
	// Flash!
	app.use(express.cookieParser());
    app.use(express.session({ store: new RedisStore({ client: rclient }), secret: configuration.hashid }))
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
});

app.configure('production', function() {
    mongoose.connect(configuration.production.mongo.address);
});

// Setup routes
app.get('/', index.get);
app.get('/stats', index.stats);

app.get('/template', function (req, res) {
    res.render('emails/setup', { title: 'WAFFLEStats' });
});

app.get('/current/:address', current.temp_api);
app.get('/historical/hashRate/:address/:resolution/:range', historical.granularHashRate);
app.get('/historical/balances/:address/:resolution/:range', historical.granularBalances);

app.get('/notifications/:address', notifications.get);
app.post('/notifications/:address', notifications.post);

app.get('/notifications/config/:hashid', notifications.config.get);
app.post('/notifications/config/:hashid', notifications.config.post);

app.get('/notifications/remove/:hashid', notifications.remove.get);
app.get('/notifications/remove/confirm/:hashid', notifications.remove.confirm.get);

app.get('/metrics', metrics.get);

// Backwards compatibility
app.get('/temp-api/:address', current.temp_api);
app.get('/historical/:address', historical.get);

http.createServer(app).listen(app.get('port'), function(){
  console.log(
          'Express server listening on port %d within %s environment',
          app.get('port'), app.get('env')
      );
});

Fetch.start();
