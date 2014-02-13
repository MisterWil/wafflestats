
/**
 * Module dependencies.
 */

var express = require('express');
var mongoose = require('mongoose');
var routes = require('./routes')();
var http = require('http');
var path = require('path');

var redis = require("redis");
var rclient = redis.createClient();

// Initialize mongoose schemas
require('./models/models.js').initialize();

var app = express();

var current = require('./routes/current')(app, rclient);
var historical = require('./routes/historical')(app, rclient);

app.configure(function() {
	// Waffles Version Info
	app.set('wafflesVersion', '0.62');

	// all environments
	app.set('port', process.env.PORT || 3000);
	app.set('views', path.join(__dirname, 'views'));
	app.set('view engine', 'jade');
	app.use(express.favicon());
	app.use(express.logger('dev'));
	app.use(express.json());
	app.use(express.urlencoded());
	app.use(express.methodOverride());
	app.use(app.router);
	app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function() {
	app.use(express.errorHandler());
	app.locals.pretty = true;
	mongoose.connect('mongodb://localhost/waffles-dev');
});

app.configure('test', function() {
	app.use(express.errorHandler());
	app.locals.pretty = true;
	mongoose.connect('mongodb://localhost/waffles-test');
});

app.configure('production', function() {
	mongoose.connect('mongodb://localhost/waffles');
});

// Setup routes
app.get('/', routes.index);
app.get('/stats', routes.stats);

app.get('/current/:address', current.temp_api);
app.get('/historical/hashRate/:address/:resolution/:range', historical.granularHashRate);
app.get('/historical/balances/:address/:resolution/:range', historical.granularBalances);

// Backwards compatibility
app.get('/temp-api/:address', current.temp_api);
app.get('/historical/:address', historical.get);

http.createServer(app).listen(app.get('port'), function(){
  console.log(
          'Express server listening on port %d within %s environment',
          app.get('port'), app.get('env')
      );
});
