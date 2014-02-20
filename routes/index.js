module.exports = function() {
	var routes = {};
	
	routes.get = function(req, res){
		  res.render('index', { title: 'WAFFLEStats' });
	};
	
	routes.stats = function(req, res){
		  res.render('waffleStats', { title: 'WAFFLEStats' });
	};
	
	return routes;
};