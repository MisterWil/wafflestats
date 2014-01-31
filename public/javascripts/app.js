// Hashrate storage array [timestamp, hashrate]
var hashrate = [];

// Balance storage arrays [timestamp, bitcoin value]
var sentBal = [];
var confirmedBal = [];
var unconvertedBal = [];

// Graphs
var hashRateMeter = null;
var hashRateGraph = null;
var balancesGraph = null;
var graphs = [ hashRateMeter, hashRateGraph, balancesGraph ];

// Last data update
var lastUpdate = 0;

// Storage for initial running version
var wafflesVersion = null;

// API proxy address and Bitcoin address
var url = '/temp-api/';
var address = null;

// Interval object storage and setup
var intervalId = 0;
var updateInterval = 30000;

// Format Strings
var hashrateFormatString = "%.2f kH/s";
var bitcoinFormatString = "฿ %.8f";

// Graph setup
var graphDefaults = {
	seriesDefaults : {
        shadow: false,
		markerOptions : {
			show : true,
			size : 8
		}
	},
	axesDefaults : {
		pad : 1.2
	},
	axes : {
		xaxis : {
			renderer : $.jqplot.DateAxisRenderer,
			tickRenderer : $.jqplot.CanvasAxisTickRenderer,
			tickOptions : {
				formatString : '%H:%M:%S',
			},
			tickInterval : '10 minute'
		},
		yaxis : {
			min : 0.0
		}
	},
	highlighter : {
		show : true,
		sizeAdjust : 7.5
	},
	cursor : {
		show : false
	}
};

/*
 * This is called whenever the graph replot occurs and the data array has
 * more than graph_ReplotNum ticks. This is to allow for the first
 * graph_ReplotNum ticks being visible, but then more than graph_ReplotNum
 * ticks will change to a more favorable line shart view.
 */
var graph_ReplotNum = 1;
var graph_ReplotConfig = {
	seriesDefaults : {
		markerOptions : {
			show : false
		}
	}
};

// Hashrate meter config (not overridden)
var hashRateMeterConfig = {
	seriesDefaults : {
		renderer : $.jqplot.MeterGaugeRenderer,
		rendererOptions : {
			label : '0.0 kH/s',
			labelPosition : 'bottom'
		}
	}
};

// Hashrate override configuration
var hashRateGraphConfig = {
	series : [ {
		label : 'Hashrate',
		color : 'rgba(255, 61, 61, 1)'
	} ],
	axes : {
		yaxis : {
			tickOptions : {
				formatString : hashrateFormatString
			}
		}
	}
};

// Balance history override configuration
var balanceHistoryGraphConfig = {
	series : [ {
		label : 'Confirmed',
		color : 'rgba(61, 255, 61, 1)'
	}, {
		label : 'Unconverted',
		color : 'rgba(255, 165, 61, 1)'
	} ],
	axes : {
		yaxis : {
			tickOptions : {
				formatString : bitcoinFormatString
			}
		}
	}
};

// Disable caching of AJAX responses, hopefully fixes IE?
$.ajaxSetup({
	cache : false
});

$(document).ready(function() {

	// Grab Bitcoin address
	address = $.getUrlVar('address');

	if (address === undefined) {
		$("#welcomePage").show();
	} else {
		$("#waffleStats").show();

		initGraphs();

		startInterval();
	}
	
	$("#start").click(function() {
		startInterval();
	});
	
	$("#stop").click(function() {
		stopInterval();
	});
});

$( window ).resize(function() {
	replotGraphs();
});

function initGraphs() {
	// Create hashrate Meter
	hashRateMeter = $.jqplot('hashRateMeter', [ [ 1 ] ], hashRateMeterConfig);

	// Create hashrate graph
	hashRateGraph = $.jqplot('hashRateGraph', [ [ null ] ], $.extend(true,
			graphDefaults, hashRateGraphConfig));

	// Create balances graph
	balancesGraph = $.jqplot('balancesGraph', [ [ null ] ], $.extend(true,
			graphDefaults, balanceHistoryGraphConfig));
};

function doUpdate() {
	if (address != undefined) {
		$.getJSON(url + address, function(data) {

			lastUpdate = new Date().getTime();
			
			performVersionCheck(data);

			updateGraphDataArrays(data);

			replotGraphs();

			updateValues();
		});
	}
};

function performVersionCheck(data) {
	var rcvdVersion = data.wafflesVersion;
	console.log(wafflesVersion + " - " + rcvdVersion);
	if (wafflesVersion === null) {
		wafflesVersion = rcvdVersion;
	} else {
		if (wafflesVersion !== rcvdVersion) {
			$("#versionOutOfDate").show();
		}
	}
	
}

function updateGraphDataArrays(data) {
	var sentBalance = parseFloat(data.balances.sent);
	var confirmedBalance = parseFloat(data.balances.confirmed);
	var unconvertedBalance = parseFloat(data.balances.unconverted);

	sentBal.push([ lastUpdate, sentBalance ]);
	confirmedBal.push([ lastUpdate, confirmedBalance ]);
	unconvertedBal.push([ lastUpdate, unconvertedBalance ]);

	var rawHR = parseInt(data.hash_rate);
	var khashrate = rawHR / 1000.0;
	hashrate.push([ lastUpdate, khashrate ]);
}

function replotGraphs() {
	// Hash Rate Meter Replot
	hashRateMeter.resetAxesScale();
	hashRateMeter.replot({
		data : [ [ hashrate.last()[1] ] ],
		seriesDefaults : {
			rendererOptions : {
				label : sprintf(hashrateFormatString, hashrate.last()[1])
			}
		}
	});
	
	var tickValues = getTickValues();

	var hashRateReplotObject = {
		data : [ hashrate ],
		axes : {
			xaxis : {
				tickInterval : tickValues[0],
				tickOptions : {
					formatString : tickValues[1]
				}
			}
		}
	};

	// Hash Rate Historical Graph Replot
	if (hashrate.length > graph_ReplotNum) {
		hashRateReplotObject = $.extend(true, hashRateReplotObject,
				graph_ReplotConfig);
	}

	hashRateGraph.resetAxesScale();
	hashRateGraph.replot(hashRateReplotObject);

	// Balances Historical Graph Replot
	var balancesReplotObject = {
		data : [ confirmedBal, unconvertedBal ],
		axes : {
			xaxis : {
				tickInterval : tickValues[0],
				tickOptions : {
					formatString : tickValues[1]
				}
			}
		}
	};

	if (confirmedBal.length > graph_ReplotNum) {
		balancesReplotObject = $.extend(true, balancesReplotObject,
				graph_ReplotConfig);
	}

	balancesGraph.resetAxesScale();
	balancesGraph.replot(balancesReplotObject);
}

/**
 * @returns An array containing the tickInterval and the formatString
 */
function getTickValues() {
	var values = ['1 minute', '%H:%M:%S'];
	
	if (hashrate.length > 0) {
		var startTimestamp = hashrate[0][0];
		var endTimestamp = hashrate.last()[0];
		
		var totalTime = endTimestamp - startTimestamp;
		
		var hours=(totalTime/(1000*60*60))%24;
		var minutes=(totalTime/(1000*60))%60;

		if (hours > 72) {
			values = ['1 day', '%H:%M:%S'];
		} else if (hours > 24) {
			values = ['12 hours', '%b %d %H:%M:%S'];
		} else if (hours > 5) {
			values = ['6 hours', '%H:%M:%S'];
		} else if (minutes > 60) {
			values = ['1 hour', '%H:%M:%S'];
		} else if (minutes > 30) {
			values = ['30 minute', '%H:%M:%S'];
		} else if (minutes > 10) {
			values = ['10 minute', '%H:%M:%S'];
		} else if (minutes > 5) {
			values = ['5 minute', '%H:%M:%S'];
		}
	}
	
	return values;
}

function updateValues() {
	updateHashrateMetrics();
	
	$('#sentBalance').html(sprintf(bitcoinFormatString, sentBal.last()[1]));
	$('#confirmedBalance').html(sprintf(bitcoinFormatString, confirmedBal.last()[1]));
	$('#unconvertedBalance').html(sprintf(bitcoinFormatString, unconvertedBal.last()[1]));

	$('#lastUpdatedValue').html(new Date(lastUpdate).toLocaleString());
}

function updateHashrateMetrics() {
	var length = hashrate.length;
	
	if (length > 0) {
		var min = hashrate[0][1];
		var max = hashrate[0][1];
		var sum = hashrate[0][1];
		
		if (length > 1) {
			for (var i = 1; i < hashrate.length; i++) {
				var val = hashrate[i][1];
				min = Math.min(min, val);
				max = Math.max(max, val);
				sum += val;
			}
		}
		
		var average = sum / length;
		
		$('#averageHashRateValue').html(sprintf(hashrateFormatString, average));
		$('#minimumHashRateValue').html(sprintf(hashrateFormatString, min));
		$('#maximumHashRateValue').html(sprintf(hashrateFormatString, max));
	}
}

function startInterval() {
	if (intervalId == 0) {
		
		// Prevent rapid pinging of stop->start to force updates
		var milliSinceLastUpdate = new Date().getTime() - lastUpdate;
		if (milliSinceLastUpdate > 10000) {
			doUpdate();
		}
		
		intervalId = self.setInterval(function() {
			doUpdate();
		}, updateInterval);
		
		$('#status').html('live');
	} else {
		console.log("Interval already started!");
	}
};

function stopInterval() {
	if (intervalId != 0) {
		clearInterval(intervalId);
		intervalId = 0;
		$('#status').html('paused');
	}
};

$.extend({
	getUrlVars : function() {
		var vars = [], hash;
		var hashes = window.location.href.slice(
				window.location.href.indexOf('?') + 1).split('&');
		for ( var i = 0; i < hashes.length; i++) {
			hash = hashes[i].split('=');
			vars.push(hash[0]);
			vars[hash[0]] = hash[1];
		}
		return vars;
	},
	getUrlVar : function(name) {
		return $.getUrlVars()[name];
	}
});

Array.prototype.last = function() {
	return this[this.length - 1];
};