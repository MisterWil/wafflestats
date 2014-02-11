var STATES = {
		// Used for History Loading State
		READY: 0,
		LOADING: 1,
		LOADED: 2,
};

var LOADING = {
	hashRate: STATES.READY,
	balances: STATES.READY
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

var DATA_RANGE = {
		HASHRATE : {
			firstValue : new Date(),
			lastValue : new Date()
		},
		BALANCES : {
			firstValue : new Date(),
			lastValue : new Date()
		}
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
};

var APP = {
	visible: true,
	loaded: false,
	idle: false,
	hiddenTime: new Date(0)
};

// Last API Update
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
var idleTimeout = 1000 * 60;

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
			size : 4
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

$(document).ready(function() {

	// Grab Bitcoin address
	address = $.getUrlVar('address');
	
	if (address !== undefined) {
		address = address.trim().replace('#','');
		
		if (!btcAddressRegex.test(address)) {
			console.log(sprintf('BTC Address \'%s\' failed regex check.', address));
		}
	}
	
	// Setup focus handler
	setupFocusHandler();

	if (address === undefined) {
		$("#welcomePage").show();
	} else {
		$("#waffleStats").show();

		initControls();
		
		initGraphs();
		
		loadHistoricalData();

		startInterval();
	}
});

$( window ).resize(function() {
	replotGraphs();
});

function setupFocusHandler() {
	var hidden = "hidden";

	// Standards:
	if (hidden in document) {
		document.addEventListener("visibilitychange", onchange);
	} else if ((hidden = "mozHidden") in document) {
		document.addEventListener("mozvisibilitychange", onchange);
	} else if ((hidden = "webkitHidden") in document) {
		document.addEventListener("webkitvisibilitychange", onchange);
	} else if ((hidden = "msHidden") in document) {
		document.addEventListener("msvisibilitychange", onchange);
	} else if ('onfocusin' in document) {
		// IE 9 and lower:
		document.onfocusin = document.onfocusout = onchange;
	} else {
		// All others:
		window.onpageshow = window.onpagehide = window.onfocus = window.onblur = onchange;
	}

	function onchange(evt) {
		var v = 'visible', h = 'hidden';
		var state = v;
		
		var evtMap = {
			focus : v,
			focusin : v,
			pageshow : v,
			blur : h,
			focusout : h,
			pagehide : h
		};

		evt = evt || window.event;

		if (evt.type in evtMap) {
			state = evtMap[evt.type];
		} else {
			state = this[hidden] ? "hidden" : "visible";
		}

		if (state === h) {
			APP.visible = false;
			console.log('invisible');
			APP.hiddenTime = new Date();
		} else {
			APP.visible = true;
			console.log('visible');
		}
	}
}

function initControls() {
	$("#idleMessage").dialog({
	      modal: true,
	      autoOpen: false,
	      close: function(event, ui) {
	    	  APP.idle = false;
	      },
	      buttons: {
	          "Mmm, Fat!": function() {
	            $( this ).dialog( "close" );
	          }
	      }
	});
	
	$("#idleMode").button().click(function (event) {
		APP.idle = true;
		openIdleDialog();
	});
	
	$("#range_hashRate").buttonset({ items: ":radio:visible" });
	$("#resolution_hashRate").buttonset({ items: ":radio:visible" });
	
	$("#range_balances").buttonset({ items: ":radio:visible" });
	$("#resolution_balances").buttonset({ items: ":radio:visible" });
	
	$('input:radio[name="resolution_hashRate"]').click(function() {
		if (LOADING.hashRate === STATES.READY) {
			TIME_SCALES.HASHRATE.resolution = $(this).val();
		}
		updateHashRateHistory();
	});
	
	$('input:radio[name="range_hashRate"]').click(function() {
		if (LOADING.hashRate === STATES.READY) {
			TIME_SCALES.HASHRATE.range = $(this).val();
		}
		updateHashRateHistory();
	});
	
	$('input:radio[name="resolution_balances"]').click(function() {
		if (LOADING.balances === STATES.READY) {
			TIME_SCALES.BALANCES.resolution = $(this).val();
		}
		updateBalancesHistory();
	});
	
	$('input:radio[name="range_balances"]').click(function() {
		if (LOADING.balances === STATES.READY) {
			TIME_SCALES.BALANCES.range = $(this).val();
		}
		updateBalancesHistory();
	});
}

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

function loadHistoricalData() {
	console.log('LOADING DATA');
	
	updateHashRateHistory();
	updateBalancesHistory();
	
	APP.loaded = true;
}

function unloadData() {
	console.log('UNLOADING DATA');
	
	clearHistoricalHashRate();
	clearHistoricalBalances();
	
	clearCurrentData();
	
	APP.loaded = false;
}

function updateHashRateHistory() {
	TIME_SCALES.HASHRATE.range = setTimeScaleRange(TIME_SCALES.HASHRATE.range,
			TIME_SCALES.HASHRATE.resolution, 'hashRate');
	
	if (LOADING.hashRate === STATES.READY) {
		LOADING.hashRate = STATES.LOADING;
		showHashRateLoading();
		
		var url = sprintf(historicalHashRateURL, address, TIME_SCALES.HASHRATE.resolution, TIME_SCALES.HASHRATE.range);
		$.getJSON(url, function(history) {
			if (history !== undefined && history.length > 0) {
				processHistoricalHashRate(history);
			}
			LOADING.hashRate = STATES.LOADED;
		});
	}

	updateTimeScales(TIME_SCALES.HASHRATE.range, TIME_SCALES.HASHRATE.resolution, 'hashRate');
}

function updateBalancesHistory() {
	TIME_SCALES.BALANCES.range = setTimeScaleRange(TIME_SCALES.BALANCES.range,
			TIME_SCALES.BALANCES.resolution, 'balances');
	
	if (LOADING.balances === STATES.READY) {
		LOADING.balances = STATES.LOADING;
		showBalancesLoading();
		
		var url = sprintf(historicalBalancesURL, address, TIME_SCALES.BALANCES.resolution, TIME_SCALES.BALANCES.range);
		$.getJSON(url, function(history) {
			if (history !== undefined && history.length > 0) {
				processHistoricalBalances(history);
			}
			LOADING.balances = STATES.LOADED;
		});
	}
	
	updateTimeScales(TIME_SCALES.BALANCES.range, TIME_SCALES.BALANCES.resolution, 'balances');
}

function setTimeScaleRange(range, resolution, id) {
	if (resolution == '1hr' || resolution == '1day') {
		if ($.inArray(range, ['1hr', '6hr', '12hr', '24hr']) !== -1) {
			range = '1day';
		}
		$("#range_" + id + ' .smallRange').hide();
		$("#range_" + id + ' .largeRange').show();
	} else {
		if ($.inArray(range, ['1day', '1wk', '2wk', '1mo']) !== -1) {
			range = '24hr';
		}
		$("#range_" + id + ' .smallRange').show();
		$("#range_" + id + ' .largeRange').hide();
	}
	
	return range;
}

function updateTimeScales(range, resolution, id) {
	$('input[name="range_'+id+'"][value="' + range + '"]').prop('checked', true);
	$("#range_"+id).buttonset("refresh");
	
	$('input[name="resolution_'+id+'"][value="' + resolution + '"]').prop('checked', true);
	$("#resolution_"+id).buttonset("refresh");
}

function processHistoricalHashRate(history) {
	var histLen = history.length;
	
	clearHistoricalHashRate();

	for (var i = 0; i < histLen; i++) {
		var data = history[i];
		var date = new Date(data.createdAt);
		
		if (date.getTime() < DATA_RANGE.HASHRATE.firstValue.getTime()) {
			DATA_RANGE.HASHRATE.firstValue = date;
		}
		
		if (date.getTime() > DATA_RANGE.HASHRATE.lastValue.getTime()) {
			DATA_RANGE.HASHRATE.lastValue = date;
		}

		var khashrate = data.hashRate / 1000.0;
		HISTORICAL_DATA.hashRate.push([ date, khashrate ]);
	}
}

function processHistoricalBalances(history) {
	var histLen = history.length;
	
	clearHistoricalBalances();
	
	for (var i = 0; i < histLen; i++) {
		var data = history[i];
		var date = new Date(data.createdAt);
		
		if (date.getTime() < DATA_RANGE.BALANCES.firstValue.getTime()) {
			DATA_RANGE.BALANCES.firstValue = date;
		}
		
		if (date.getTime() > DATA_RANGE.BALANCES.lastValue.getTime()) {
			DATA_RANGE.BALANCES.lastValue = date;
		}
		
		HISTORICAL_DATA.sent.push([ date, data.balances.sent ]);
		HISTORICAL_DATA.confirmed.push([ date, data.balances.confirmed ]);
		HISTORICAL_DATA.unconverted.push([ date, data.balances.unconverted ]);
	}
}

function clearHistoricalHashRate() {
	DATA_RANGE.HASHRATE.firstValue = new Date();
	//DATA_RANGE.HASHRATE.lastValue = new Date();
	
	HISTORICAL_DATA.hashRate = [];
}

function clearHistoricalBalances() {
	DATA_RANGE.BALANCES.firstValue = new Date();
	//DATA_RANGE.BALANCES.lastValue = new Date();
	
	HISTORICAL_DATA.sent = [];
	HISTORICAL_DATA.confirmed = [];
	HISTORICAL_DATA.unconverted = [];
}

function clearCurrentData() {
	CURRENT_DATA.hashRate = [];
	CURRENT_DATA.sent = [];
	CURRENT_DATA.confirmed = [];
	CURRENT_DATA.unconverted = [];
}

function doUpdate() {
	var lastAPICall = new Date().getTime() - lastUpdate.getTime();	
	
	if (lastAPICall >= apiInterval) {
		if (address != undefined && btcAddressRegex.test(address)) {
			updateAPI();
		}
	}
	
	checkIdle();
	
	if (APP.idle && APP.loaded) {
		unloadData();
		openIdleDialog();
		updateGUI();
	} else if (!APP.idle && !APP.loaded) {
		loadHistoricalData();
	} else if (!APP.idle && APP.loaded) {
		updateGUI();
	}
}

function checkIdle() {
	if (!APP.visible && !APP.idle) {
		var hiddenDuration = new Date().getTime() - APP.hiddenTime.getTime();
		
		if (hiddenDuration >= idleTimeout) {
			APP.idle = true;
		}
	}
}

function updateAPI() {
	lastUpdate = new Date();
	
	$.getJSON(currentURL + address, function(data) {
		if (data !== undefined && data.error == "" || data.error === undefined) {
			hideError();

			performVersionCheck(data);

			// Only fill data arrays when not idle
			if (!APP.idle) {
				updateGraphDataArrays(new Date(), data);
			}
		} else {
			showError(data.error);
		}
	}).error(function(err) {
		showError('Local Server Unreachable');
	});
}

function updateGUI() {
	checkLoaded();
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
		
		DATA_RANGE.HASHRATE.lastValue = date;
		DATA_RANGE.BALANCES.lastValue = date;
		
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

function checkLoaded() {
	if (LOADING.hashRate === STATES.LOADED) {
		LOADING.hashRate = STATES.READY;
		hideHashRateLoading();
	}
	
	if (LOADING.balances === STATES.LOADED) {
		LOADING.balances = STATES.READY;
		hideBalancesLoading();
	}
}

function replotGraphs() {
	// Replot Hash Rate Meter
	GRAPHS.hashRateMeter.resetAxesScale();
	GRAPHS.hashRateMeter.replot({
		data : [ [ getLastValue(CURRENT_DATA.hashRate, 1, 1) ] ],
		seriesDefaults : {
			rendererOptions : {
				label : sprintf(hashrateFormatString, getLastValue(CURRENT_DATA.hashRate, 1, 0))
			}
		}
	});
	
	// Replot Hash Rate History Graph
	if (LOADING.hashRate === STATES.READY) {
		var hashRateTickValues = getTickValues(DATA_RANGE.HASHRATE.firstValue, DATA_RANGE.HASHRATE.lastValue);
		
		var hashRateReplotObject = {
			data : [ CURRENT_DATA.hashRate, HISTORICAL_DATA.hashRate ],
			axes : {
				xaxis : {
					tickInterval : hashRateTickValues[0],
					tickOptions : {
						formatString : hashRateTickValues[1]
					}
				}
			}
		};
	
		GRAPHS.hashRateHistory.resetAxesScale();
		GRAPHS.hashRateHistory.replot(hashRateReplotObject);
	}

	// Replot Balances History Graph
	if (LOADING.balances === STATES.READY) {
		var balancesTickValues = getTickValues(DATA_RANGE.BALANCES.firstValue, DATA_RANGE.BALANCES.lastValue);
		
		var balancesReplotObject = {
			data : [ CURRENT_DATA.confirmed, CURRENT_DATA.unconverted, HISTORICAL_DATA.confirmed, HISTORICAL_DATA.unconverted ],
			axes : {
				xaxis : {
					tickInterval : balancesTickValues[0],
					tickOptions : {
						formatString : balancesTickValues[1]
					}
				}
			}
		};
	
		GRAPHS.balancesHistory.resetAxesScale();
		GRAPHS.balancesHistory.replot(balancesReplotObject);
	}
}

/**
 * @returns An array containing the tickInterval and the formatString
 */
function getTickValues(firstValue, lastValue) {
	var values = ['1 minute', '%H:%M:%S'];
	
	var totalTime = lastValue.getTime() - firstValue.getTime();
	
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

	if (lastUpdate.getTime() > 0) {
		$('#lastUpdatedValue').html(lastUpdate.toLocaleString());
	} else {
		$('#lastUpdatedValue').html('Never');
	}
}

function getLastValue(array, index, undefVal) {
	var arr = array.last();
	
	if (arr!== undefined && arr[index] !== undefined) {
		return arr[index];
	}
	
	return undefVal;
}

function updateHashrateMetrics() {
	var min = 0;
	var max = 0;
	var sum = 0;
	var average = 0;
	
	var histLength = HISTORICAL_DATA.hashRate.length;
	var curLength = CURRENT_DATA.hashRate.length;
	
	if (histLength > 0) {
		min = HISTORICAL_DATA.hashRate[0][1];
		max = HISTORICAL_DATA.hashRate[0][1];
		
		for (var i = 0; i < histLength; i++) {
			var val = HISTORICAL_DATA.hashRate[i][1];
			min = Math.min(min, val);
			max = Math.max(max, val);
			sum += val;
		}
	}
	
	for (var i = 0; i < curLength; i++) {
		var val = CURRENT_DATA.hashRate[i][1];
		min = Math.min(min, val);
		max = Math.max(max, val);
		sum += val;
	}
	
	var totalLength = histLength + curLength;
	
	if (totalLength > 0) {
		average = sum / totalLength;
	}
	
	$('#averageHashRateValue').html(sprintf(hashrateFormatString, average));
	$('#minimumHashRateValue').html(sprintf(hashrateFormatString, min));
	$('#maximumHashRateValue').html(sprintf(hashrateFormatString, max));
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

function openIdleDialog() {
	if (!$("#idleMessage").dialog("isOpen")) {
		$("#idleMessage").dialog("open");
	}
}

function isIdleDialogOpen() {
	return $("#idleMessage").dialog("isOpen");
}

function closeIdleDialog() {
	if (isIdleDialogOpen()) {
		$("#idleMessage").dialog("close");
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
		intervalId = self.setInterval(function() {
			doUpdate();
		}, updateInterval);
		
		$('#status').html('live');
	} else {
		console.log("Interval already started!");
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