// When loading data, don't update graphs
var LOADING = {
		hashRate : false,
		balances : false
};

var HISTORICAL_DATA = {
		hashRate : [],
		sent : [],
		confirmed : [],
		unconverted : []
};

var CURRENT_DATA = {
		hashRate : [],
		sent : [],
		confirmed : [],
		unconverted : []
};

var GRAPHS = {
		hashRateMeter : null,
		hashRateHistory : null,
		balancesHistory : null
};

var TIME_SCALES = {
	HASHRATE : {
		resolution: '5min',
		range: '24hr'
	},
	BALANCES : {
		resolution: '1hr',
		range: '1wk'
	}
}

// Data range values
var firstValue = new Date();
var lastUpdate = new Date(0);

// Last result cacheID
var cacheID = null;

// Storage for initial running version
var wafflesVersion = null;

// API proxy address and Bitcoin address
var currentURL = '/current/';
var historicalHashRateURL = '/historical/hashRate/%s/%s/%s'; // /historical/hashRate/{btcAddr}/{resolution}/{range}
var historicalBalancesURL = '/historical/balances/%s/%s/%s'; // /historical/balances/{btcAddr}/{resolution}/{range}
var address = null;

// Interval object storage, how often to update, and how often to query the API
var intervalId = 0;
var updateInterval = 1000 * 1; // Set to 5 seconds until history is loaded
var apiInterval = 1000 * 60;

// Format Strings
var hashrateFormatString = "%.2f kH/s";
var bitcoinFormatString = "฿ %.8f";

// Regex to test bitcoin addresses before pinging for current data
// Disabled for historical data so I can test locally using historical data
var btcAddressRegex = /^[13][1-9A-HJ-NP-Za-km-z]{26,33}/;

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
		label : 'Live Hashrate',
		color : 'rgba(255, 61, 61, 1)'
	},
	{
		label : 'Historical Hashrate',
		color : 'rgba(255, 61, 61, 0.5)'
	}],
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
		label : 'Live Confirmed',
		color : 'rgba(61, 255, 61, 1)'
	}, {
		label : 'Live Unconverted',
		color : 'rgba(255, 165, 61, 1)'
	},
	{
		label : 'Historical Confirmed',
		color : 'rgba(61, 255, 61, 0.5)'
	}, {
		label : 'Historical Unconverted',
		color : 'rgba(255, 165, 61, 0.5)'
	}],
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

$(function() {
	$("#run").buttonset();
	$("#hashRateTimeScale").buttonset();
	$("#balancesTimeScale").buttonset();
	
	$('input:radio[name="resolution_hashRate"]').click(function() {
		if (!LOADING.hashRate) {
			TIME_SCALES.HASHRATE.resolution = $(this).val();
		}
		updateHashRateHistory();
	});
	
	$('input:radio[name="range_hashRate"]').click(function() {
		if (!LOADING.hashRate) {
			TIME_SCALES.HASHRATE.range = $(this).val();
		}
		updateHashRateHistory();
	});
	
	$('input:radio[name="resolution_balances"]').click(function() {
		if (!LOADING.balances) {
			TIME_SCALES.BALANCES.resolution = $(this).val();
		}
		updateBalancesHistory();
	});
	
	$('input:radio[name="range_balances"]').click(function() {
		if (!LOADING.balances) {
			TIME_SCALES.BALANCES.range = $(this).val();
		}
		updateBalancesHistory();
		
		$('input[name="range_balances"][value="12hr"]').prop('checked', true);
		$('#balancesTimeScale').buttonset("refresh");
	});
});

$(document).ready(function() {

	// Grab Bitcoin address
	address = $.getUrlVar('address').trim();

	if (address === undefined) {
		$("#welcomePage").show();
	} else {
		$("#waffleStats").show();

		initGraphs();
		
		updateHashRateHistory();
		updateBalancesHistory();

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
	GRAPHS.hashRateMeter = $.jqplot('hashRateMeter', [ [ 1 ] ], hashRateMeterConfig);

	// Create hashrate graph
	GRAPHS.hashRateHistory = $.jqplot('hashRateGraph', [ [ null ] ], $.extend(true,
			graphDefaults, hashRateGraphConfig));

	// Create balances graph
	GRAPHS.balancesHistory = $.jqplot('balancesGraph', [ [ null ] ], $.extend(true,
			graphDefaults, balanceHistoryGraphConfig));
};

function updateHashRateHistory() {
	if (!LOADING.hashRate) {
		LOADING.hashRate = true;
		showHashRateLoading();
		
		
	}
	
	$('input[name="resolution_hashRate"][value="' + TIME_SCALES.HASHRATE.resolution + '"]').prop('checked', true);
	$('input[name="range_hashRate"][value="' + TIME_SCALES.HASHRATE.range + '"]').prop('checked', true);
	$('#hashRateTimeScale').buttonset("refresh");
}

function updateBalancesHistory() {
	if (TIME_SCALES.BALANCES.resolution == '1hr' || TIME_SCALES.BALANCES.resolution == '1day') {
		if ($.inArray(TIME_SCALES.BALANCES.range, ['1hr', '6hr', '12hr', '24hr'])) {
			TIME_SCALES.BALANCES.range = '1day';
		}
		$('#balancesTimeScale .smallRange').hide();
		$('#balancesTimeScale .largeRange').show();
	} else {
		if (!$.inArray(TIME_SCALES.BALANCES.range, ['1hr', '6hr', '12hr', '24hr'])) {
			TIME_SCALES.BALANCES.range = '24hr';
		}
		$('#balancesTimeScale .largeRange').hide();
		$('#balancesTimeScale .smallRange').show();
	}
	
	/*if (!LOADING.balances) {
		LOADING.balances = true;
		showBalancesLoading();
		
		var url = sprintf(historicalHashRateURL, address);
		$.getJSON(url, function(history) {
			if (history !== undefined && history.length > 0) {
				prepareHistoricalData(history);
			}
		});
	}*/
	
	$('input[name="resolution_balances"][value="' + TIME_SCALES.BALANCES.resolution + '"]').prop('checked', true);
	$('input[name="range_balances"][value="' + TIME_SCALES.BALANCES.range + '"]').prop('checked', true);
	$('#balancesTimeScale').buttonset("refresh");
}

function getHistoricalData() {
	if (address != undefined) {
		showLoading('Loading historical data...');
		
		var url = sprintf(historicalBalancesURL, address);
		$.getJSON(url, function(history) {
			if (history !== undefined && history.length > 0) {
				prepareHistoricalData(history);
			}
		});
	}
}

function prepareHistoricalData(history) {
	var histLen = history.length;

	for (var i = 0; i < histLen; i++) {
		var data = history[i];
		var date = new Date(data.createdAt);
		
		if (date.getTime() < firstValue.getTime()) {
			firstValue = date;
		}
		
		if (date.getTime() > lastUpdate.getTime()) {
			lastUpdate = date;
		}
		
		HISTORICAL_DATA.sent.push([ date, data.balances.sent ]);
		HISTORICAL_DATA.confirmed.push([ date, data.balances.confirmed ]);
		HISTORICAL_DATA.unconverted.push([ date, data.balances.unconverted ]);

		var khashrate = data.hashRate / 1000.0;
		HISTORICAL_DATA.hashRate.push([ date, khashrate ]);
	}
	
	loadHistory = true;
}

function doUpdate() {
	if (address != undefined && btcAddressRegex.test(address)) {
		var lastAPICall = new Date().getTime() - lastUpdate.getTime();
		
		if (lastAPICall >= apiInterval) {
			updateAPI();
		}
	}
	
	updateGUI();
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
	/*if (loadHistory === true) {
		loadHistory = false;
		hideLoading();
	}*/
	
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
		
		CURRENT_DATA.sent.push([ date, formatted.balances.sent ]);
		CURRENT_DATA.confirmed.push([ date, formatted.balances.confirmed ]);
		CURRENT_DATA.unconverted.push([ date, formatted.balances.unconverted ]);
	
		var khashrate = formatted.hashRate / 1000.0;
		CURRENT_DATA.hashRate.push([ date, khashrate ]);
		
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

function replotGraphs() {
	GRAPHS.hashRateMeter.resetAxesScale();
	GRAPHS.hashRateMeter.replot({
		data : [ [ getLastValue(CURRENT_DATA.hashRate, 1, 1) ] ],
		seriesDefaults : {
			rendererOptions : {
				label : sprintf(hashrateFormatString, getLastValue(CURRENT_DATA.hashRate, 1, 1))
			}
		}
	});
	
	var tickValues = getTickValues();

	var hashRateReplotObject = {
		data : [ CURRENT_DATA.hashRate, HISTORICAL_DATA.hashRate ],
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
	//if (hashrate.length > graph_ReplotNum) {
		hashRateReplotObject = $.extend(true, hashRateReplotObject,
				graph_ReplotConfig);
	//}

	GRAPHS.hashRateHistory.resetAxesScale();
	GRAPHS.hashRateHistory.replot(hashRateReplotObject);

	// Balances Historical Graph Replot
	var balancesReplotObject = {
		data : [ CURRENT_DATA.confirmed, CURRENT_DATA.unconverted, HISTORICAL_DATA.confirmed, HISTORICAL_DATA.unconverted ],
		axes : {
			xaxis : {
				tickInterval : tickValues[0],
				tickOptions : {
					formatString : tickValues[1]
				}
			}
		}
	};

	//if (confirmedBal.length > graph_ReplotNum) {
		balancesReplotObject = $.extend(true, balancesReplotObject,
				graph_ReplotConfig);
	//}

	GRAPHS.balancesHistory.resetAxesScale();
	GRAPHS.balancesHistory.replot(balancesReplotObject);
}

/**
 * @returns An array containing the tickInterval and the formatString
 */
function getTickValues() {
	var values = ['1 minute', '%H:%M:%S'];
	
	//if (hashrate.length > 0) {
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
	//}
	
	return values;
}

function updateValues() {
	updateHashrateMetrics();
	
	var currentSentBalance = getLastValue(CURRENT_DATA.sent, 1, 0);
	var currentConfirmedBalance = getLastValue(CURRENT_DATA.confirmed, 1, 0);
	var currentUnconvertedBalance = getLastValue(CURRENT_DATA.unconverted, 1, 0);
	
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
	var length = CURRENT_DATA.hashRate.length;
	
	if (length > 0) {
		var min = CURRENT_DATA.hashRate[0][1];
		var max = CURRENT_DATA.hashRate[0][1];
		var sum = CURRENT_DATA.hashRate[0][1];
		
		if (length > 1) {
			for (var i = 1; i < length; i++) {
				var val = CURRENT_DATA.hashRate[i][1];
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

function showHashRateLoading() {
	$('#hashRateHistoryLoading').show();
}

function hideHashRateLoading() {
	$('#hashRateHistoryLoading').hide();
}

function showBalancesLoading() {
	$('#balancesHistoryLoading').show();
}

function hideBalancesLoading() {
	$('#balancesHistoryLoading').hide();
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