
/**
 * Module dependencies.
 */

var express = require('express');
var mongoose = require('mongoose');
var routes = require('./routes');
var http = require('http');
var path = require('path');

// Initialize mongoose schemas
require('./models/models.js').initialize();

var app = express();

var current = require('./routes/current')(app);
var historical = require('./routes/historical')(app);

app.configure(function() {
	// Waffles Version Info
	app.set('wafflesVersion', '0.3');

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
	console.log("DEV");
});

app.configure('test', function() {
	app.use(express.errorHandler());
	app.locals.pretty = true;
	mongoose.connect('mongodb://localhost/waffles-test');
	console.log("TEST");
});

app.configure('production', function() {
	app.use(express.errorHandler());
	app.locals.pretty = true;
	mongoose.connect('mongodb://localhost/waffles');
	console.log("PROD");
});

app.get('/', routes.index);
app.get('/current/:address', current.temp_api);
app.get('/historical/:address', historical.get);

// Backwards compatibility
app.get('/temp-api/:address', current.temp_api);

http.createServer(app).listen(app.get('port'), function(){
  console.log(
          'Express server listening on port %d within %s environment',
          app.get('port'), app.get('env')
      );
});
