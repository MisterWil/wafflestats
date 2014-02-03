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

// Data range values
var firstValue = new Date();
var lastUpdate = new Date(0);

// Storage for initial running version
var wafflesVersion = null;

// API proxy address and Bitcoin address
var currentURL = '/current/';
var historicalURL = '/historical/';
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
		
		getHistoricalData();

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

function getHistoricalData() {
	if (address != undefined) {
		$.getJSON(historicalURL + address, function(historical) {
			if (historical !== undefined && historical.length > 0) {
				var histLen = historical[0].data.length;
				
				for (var i = 0; i < histLen; i++) {
					var data = historical[0].data[i];
					var date = new Date(data.retrieved);
					
					updateGraphDataArrays(new Date(data.retrieved), data);
					
					if (date.getTime() < firstValue.getTime()) {
						firstValue = date;
					}
				}
			}
		});
	}
}

function doUpdate() {
	if (address != undefined) {
		$.getJSON(currentURL + address, function(data) {

			if (data !== undefined && data.error == "" || data.error === undefined) {
				lastUpdate = new Date();

				hideError();

				performVersionCheck(data);
				
				var formatted = formatAPIValues(data);

				updateGraphDataArrays(lastUpdate, formatted);

				replotGraphs();

				updateValues();
			} else {
				showError(data.error);
			}
		}).error(function() {
			showError('Local server is unreachable.');
		});
	}
};

function performVersionCheck(data) {
	var rcvdVersion = data.wafflesVersion;
	
	if (wafflesVersion === null) {
		wafflesVersion = rcvdVersion;
	} else {
		if (wafflesVersion !== rcvdVersion) {
			$("#versionOutOfDate").show();
		}
	}
	
}

function formatAPIValues(data) {
	return {
		hashRate: parseInt(data.hash_rate),
		balances: {
			sent: parseFloat(data.balances.sent),
			confirmed: parseFloat(data.balances.confirmed),
			unconverted: parseFloat(data.balances.unconverted)
		}
	};
}

function updateGraphDataArrays(date, data) {
	sentBal.push([ date, data.balances.sent ]);
	confirmedBal.push([ date, data.balances.confirmed ]);
	unconvertedBal.push([ date, data.balances.unconverted ]);

	var khashrate = data.hashRate / 1000.0;
	hashrate.push([ date, khashrate ]);
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
		var startTimestamp = firstValue.getTime();
		var endTimestamp = lastUpdate.getTime();
		
		var totalTime = endTimestamp - startTimestamp;
		
		var hours=(totalTime/(1000*60*60));
		var minutes=(totalTime/(1000*60));

		if (hours > 72) {
			values = ['1 day', '%b %d %H:%M:%S'];
		} else if (hours > 24) {
			values = ['12 hours', '%b %d %H:%M:%S'];
		} else if (hours > 5) {
			values = ['6 hours', '%H:%M:%S'];
		} else if (minutes > 59) {
			values = ['60 minutes', '%H:%M:%S'];
		} else if (minutes > 25) {
			values = ['10 minutes', '%H:%M:%S'];
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

	$('#lastUpdatedValue').html(lastUpdate.toLocaleString());
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

function showError(error) {
	$('#error').html(error);
	$('#error').slideDown("slow");
}

function hideError() {
	if ($('#error').is(":visible")) {
		$('#error').slideUp("slow");
	}
}

function startInterval() {
	if (intervalId == 0) {
		
		// Prevent rapid pinging of stop->start to force updates
		var milliSinceLastUpdate = new Date().getTime() - lastUpdate.getTime();
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