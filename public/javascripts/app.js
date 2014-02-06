// Hashrate storage array [timestamp, hashrate]
var hashrate = [];

// Balance storage arrays [timestamp, bitcoin value]
var sentBal = [];
var confirmedBal = [];
var unconvertedBal = [];

// Temporary historical storage arrays
var loadHistory = false;
var sentBalHist = [];
var confirmedBalHist = [];
var unconvertedBalHist = [];
var hashrateHist = [];

// Graphs
var hashRateMeter = null;
var hashRateGraph = null;
var balancesGraph = null;
var graphs = [ hashRateMeter, hashRateGraph, balancesGraph ];

// Data range values
var firstValue = new Date();
var lastUpdate = new Date(0);

// Last result cacheID
var cacheID = null;

// Storage for initial running version
var wafflesVersion = null;

// API proxy address and Bitcoin address
var currentURL = '/current/';
var historicalURL = '/historical/';
var address = null;

// Interval object storage, how often to update, and how often to query the API
var intervalId = 0;
var updateInterval = 1000 * 5; // Set to 5 seconds until history is loaded
var apiInterval = 1000 * 60;

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
		$.getJSON(historicalURL + address, function(history) {
			if (history !== undefined && history.length > 0) {
				prepareHistoricalData(history);
			} else {
				// Reset the interval (timer) to only run as often as the API updates
				resetInterval(apiInterval);
			}
		});
	}
}

function prepareHistoricalData(history) {
	showLoading('Loading historical data...');
	
	var histLen = history.length;

	for (var i = 0; i < histLen; i++) {
		var data = history[i];
		var date = new Date(data.createdAt);
		
		if (date.getTime() < firstValue.getTime()) {
			firstValue = date;
		}
		
		sentBalHist.push([ date, data.balances.sent ]);
		confirmedBalHist.push([ date, data.balances.confirmed ]);
		unconvertedBalHist.push([ date, data.balances.unconverted ]);

		var khashrate = data.hashRate / 1000.0;
		hashrateHist.push([ date, khashrate ]);
	}
	
	loadHistory = true;
}

function doUpdate() {
	if (address != undefined) {
		var lastAPICall = new Date().getTime() - lastUpdate.getTime();
		
		if (lastAPICall >= apiInterval) {
			updateAPI();
		}
		
		updateGUI();
	}
};

function updateAPI() {
	$.getJSON(currentURL + address, function(data) {
		if (data !== undefined && data.error == "" || data.error === undefined) {
			lastUpdate = new Date();

			hideError();

			performVersionCheck(data);

			updateGraphDataArrays(lastUpdate, data);
		} else {
			showError(data.error);
		}
	}).error(function(err) {
		showError('Local server is unreachable.');
	});
}

function updateGUI() {

	loadHistoricalData();
	
	replotGraphs();
	updateValues();
}

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

function updateGraphDataArrays(date, data) {
	if (cacheID != data.cacheID) {
		var formatted = formatAPIValues(data);
		
		sentBal.push([ date, formatted.balances.sent ]);
		confirmedBal.push([ date, formatted.balances.confirmed ]);
		unconvertedBal.push([ date, formatted.balances.unconverted ]);
	
		var khashrate = formatted.hashRate / 1000.0;
		hashrate.push([ date, khashrate ]);
		
		cacheID = data.cacheID;
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

function loadHistoricalData() {
	if (loadHistory === true) {
		// Merge historical data with current data
		sentBal = sentBalHist.concat(sentBal);
		confirmedBal = confirmedBalHist.concat(confirmedBal);
		unconvertedBal = unconvertedBalHist.concat(unconvertedBal);
		hashrate = hashrateHist.concat(hashrate);
		
		// Clear historical data arrays
		sentBalHist.length = 0;
		confirmedBalHist.length = 0;
		unconvertedBalHist.length = 0;
		hashrateHist.length = 0;
		
		// Reset the interval (timer) to only run as often as the API updates
		resetInterval(apiInterval);
		
		loadHistory = false;
		hideLoading();
	}
}

function replotGraphs() {
	hashRateMeter.resetAxesScale();
	hashRateMeter.replot({
		data : [ [ getLastValue(hashrate, 1, 1) ] ],
		seriesDefaults : {
			rendererOptions : {
				label : sprintf(hashrateFormatString, getLastValue(hashrate, 1, 0))
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

		if (hours > 60) {
			values = ['1 day', '%b %d %H:%M:%S'];
		} else if (hours > 18) {
			values = ['12 hours', '%b %d %H:%M:%S'];
		} else if (hours > 5) {
			values = ['6 hours', '%b %d %H:%M:%S'];
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
	
	var currentSentBalance = getLastValue(sentBal, 1, 0);
	var currentConfirmedBalance = getLastValue(confirmedBal, 1, 0);
	var currentUnconvertedBalance = getLastValue(unconvertedBal, 1, 0);
	
	$('#sentBalance').html(sprintf(bitcoinFormatString, currentSentBalance));
	$('#confirmedBalance').html(sprintf(bitcoinFormatString, currentConfirmedBalance));
	$('#unconvertedBalance').html(sprintf(bitcoinFormatString, currentUnconvertedBalance));
	
	var totalUnsentBalance = currentConfirmedBalance + currentUnconvertedBalance;
	$('#totalUnsent').html(sprintf(bitcoinFormatString, totalUnsentBalance));

	$('#lastUpdatedValue').html(lastUpdate.toLocaleString());
}

function getLastValue(array, index, undefVal) {
	var arr = array.last();
	
	if (arr!== undefined && arr[index] !== undefined) {
		return arr[index];
	}
	
	return undefVal;
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

function showLoading(str) {
	$('#loading').html(str);
	$('#loading').slideDown("slow");
}

function hideLoading() {
	if ($('#loading').is(":visible")) {
		$('#loading').slideUp("slow");
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

function resetInterval(interval) {
	if (intervalId != 0) {
		clearInterval(intervalId);
	}
	
	updateInterval = interval;
	
	intervalId = self.setInterval(function() {
		doUpdate();
	}, interval);
}

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