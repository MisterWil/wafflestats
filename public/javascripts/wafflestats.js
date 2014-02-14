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
		hashRate : 0.0,
		sent : 0.0,
		confirmed : 0.0,
		unconverted : 0.0
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
		historicalHashrate : null,
		historicalBalances : null
};

var SHOWING = {
		BALANCES : {
			confirmed: true,
			unconverted: true,
			sent: false
		}
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

var SCALE_MILLIS = {
	val_1min: 1000*60,
	val_5min: 1000*60*5,
	val_1hr: 1000*60*60,
	val_6hr: 1000*60*60*6,
	val_12hr: 1000*60*60*12,
	val_24hr: 1000*60*60*24,
	val_1day: 1000*60*60*24,
	val_1wk: 1000*60*60*24*7,
	val_2wk: 1000*60*60*24*7*2,
	val_1mo: 1000*60*60*24*7*4,
};

var HISTORY_INTERVALS = {
	hashRate: SCALE_MILLIS['val_'+TIME_SCALES.HASHRATE.resolution],
	balances: SCALE_MILLIS['val_'+TIME_SCALES.BALANCES.resolution]
};

// Last API and History Update
var lastUpdate = new Date(0);
var lastHashrateHistoryUpdate = new Date(0);
var lastBalancesHistoryUpdate = new Date(0);

// Last result cacheID
var cacheID = null;

// Storage for initial running version
var wafflesVersion = null;

// API proxy address and Bitcoin address
var currentURL = '/current/';
var historicalHashRateURL = '/historical/hashRate/%s/%s/%s'; // /historical/hashRate/{btcAddr}/{resolution}/{range}
var historicalBalancesURL = '/historical/balances/%s/%s/%s'; // /historical/balances/{btcAddr}/{resolution}/{range}
var address = null;

// Interval object storage, how often to update the gui, api, and history
var intervalId = 0;
var updateInterval = 1000 * 1;
var apiInterval = 1000 * 60;
var idleTimeout = 1000 * 60;

// Format Strings
var hashrateFormatString = "%.2f kH/s";
var hashrateDecimalFormatString = "%.2f";
var bitcoinFormatString = "%.8f";

// Regex to test bitcoin addresses before pinging for current data
// Disabled for historical data so I can test locally using historical data
var btcAddressRegex = /^[13][1-9A-HJ-NP-Za-km-z]{26,33}/;

// Graph setup
var lineChartDefaults = {
    	chart: {
            type: 'spline'
        },
        title: {
            text: null
        },
        xAxis: {
        	type: 'datetime',
            title: {
                text: null
            },
	        dateTimeLabelFormats: {
	            month: '%e. %b',
	            year: '%b'
	        }
        },
        yAxis: {
        	min: 0
        },
        legend: {
            enabled: false
        }
};

// Historical hashrate overrides
var historicalHashrateLineChart = {
		yAxis: {
            title: {
                text: 'kHash/s'
            }
        },
        series: [{
            name: 'Hashrate',
            data: [],
            color: 'rgba(255, 61, 61, 1)',
            marker: {
            	symbol: 'circle',
            	radius: 2
            }
        }],
        tooltip: {
            valueSuffix: 'kH/s',
            valueDecimals: 2
        }
};

// Balance history override configuration
var historicalBalanceLineChart = {
	yAxis: {
        title: {
            text: 'btc'
        }
    },
    series: [{
        name: 'Confirmed',
        data: [],
        color: 'rgba(61, 61, 255, 1)',
        marker: {
        	symbol: 'circle',
        	radius: 2
        }
    },
    {
        name: 'Unconverted',
        data: [],
        color: 'rgba(255, 165, 61, 1)',
        marker: {
        	symbol: 'circle',
        	radius: 2
        }
    },
    {
        name: 'Sent',
        data: [],
        color: 'rgba(61, 255, 61, 1)',
        marker: {
        	symbol: 'circle',
        	radius: 2
        }
    }
    ],
    tooltip: {
        valuePrefix: '฿',
        valueDecimals: 8
    }
};

// Disable caching of AJAX responses, hopefully fixes IE?
$.ajaxSetup({
	cache : false
});

$(document).ready(function() {
	
	setDefaults();

	// Grab Bitcoin address
	address = $.url().param('address').trim();
	
	if (address === undefined) {
		window.location.replace('/');
		return;
	} else if (address !== undefined) {
		if (!btcAddressRegex.test(address)) {
			showError('BTC Address Error',
					"Address didn't pass regex check and thus appears invalid. This does not mean it IS invalid, however. " +
					"If this is incorrect, please contact administrator.",
					false);
		}
		
		$('#btcAddress').val(address);
	}
	
	initControls();
		
	initGraphs();
	
	updateBalancesVisibility();
		
	getHistoricalData(true);

	startInterval();
});

$( window ).resize(function() {
	reflowGraphs();
});

function setDefaults() {
	$.pnotify.defaults.history = false;
	$.pnotify.defaults.styling = "bootstrap3";
	
	Highcharts.setOptions({
        global : {
            useUTC : false
        }
    });
}

function initControls() {
	$('#resolution_hashrate button').click(function (e) {
		if (LOADING.hashRate === STATES.READY) {
			TIME_SCALES.HASHRATE.resolution = $(this).val();
			updateHashRateHistory();
		}
		e.preventDefault();
	});
	
	$('#range_hashrate button').click(function (e) {
		if (LOADING.hashRate === STATES.READY) {
			TIME_SCALES.HASHRATE.range = $(this).val();
			updateHashRateHistory();
		}
		e.preventDefault();
	});
	
	$('#resolution_balances button').click(function (e) {
		if (LOADING.balances === STATES.READY) {
			TIME_SCALES.BALANCES.resolution = $(this).val();
			updateBalancesHistory();
		}
		e.preventDefault();
	});
	
	$('#range_balances button').click(function (e) {
		if (LOADING.balances === STATES.READY) {
			TIME_SCALES.BALANCES.range = $(this).val();
			updateBalancesHistory();
		}
		e.preventDefault();
	});
	
	// Set visiblity defaults
	if (SHOWING.BALANCES.confirmed) {
		$('#visibility_balances label[value="confirmed"]').button('toggle');
	}
	if (SHOWING.BALANCES.unconverted) {
		$('#visibility_balances label[value="unconverted"]').button('toggle');
	}
	if (SHOWING.BALANCES.sent) {
		$('#visibility_balances label[value="sent"]').button('toggle');
	}
	
	$('#visibility_balances label').click(function (e) {
		var name = $(this).find('input').val();
		
		SHOWING.BALANCES[name] = !SHOWING.BALANCES[name];
		
		updateBalancesVisibility();
	});
}

function initGraphs() {
	// Create hashrate graph
	$('#historalHashrate').highcharts($.extend(true, {}, lineChartDefaults, historicalHashrateLineChart));
	GRAPHS.historicalHashrate = $('#historalHashrate').highcharts();

	// Create balances graph
	$('#historicalBalances').highcharts($.extend(true, {}, lineChartDefaults, historicalBalanceLineChart));
	GRAPHS.historicalBalances = $('#historicalBalances').highcharts();
};

function getHistoricalData(force) {
	var lastHashrateHistoryCall = new Date().getTime() - lastHashrateHistoryUpdate.getTime();
	if (force || lastHashrateHistoryCall >= HISTORY_INTERVALS.hashRate) {
		updateHashRateHistory();
	}
	
	var lastHashrateBalancesCall = new Date().getTime() - lastBalancesHistoryUpdate.getTime();
	if (force || lastHashrateBalancesCall >= HISTORY_INTERVALS.balances) {
		updateBalancesHistory();
	}
}

function unloadData() {
	clearHistoricalHashRate();
	clearHistoricalBalances();
}

function updateHashRateHistory() {
	TIME_SCALES.HASHRATE.range = setTimeScaleRange(TIME_SCALES.HASHRATE.range,
			TIME_SCALES.HASHRATE.resolution, 'hashrate');
	
	HISTORY_INTERVALS.hashRate = SCALE_MILLIS['val_'+TIME_SCALES.HASHRATE.resolution];
	
	if (LOADING.hashRate === STATES.READY) {
		LOADING.hashRate = STATES.LOADING;
		
		lastHashrateHistoryUpdate = new Date();
		
		disableTimeScaleButtons('hashrate');
		
		showHashRateLoading();
		
		var url = sprintf(historicalHashRateURL, address, TIME_SCALES.HASHRATE.resolution, TIME_SCALES.HASHRATE.range);
		$.getJSON(url, function(history) {
			if (history !== undefined && history.length > 0) {
				processHistoricalHashRate(history);
			}
			LOADING.hashRate = STATES.LOADED;
		});
	}

	updateTimeScales(TIME_SCALES.HASHRATE.range, TIME_SCALES.HASHRATE.resolution, 'hashrate');
}

function updateBalancesHistory() {
	TIME_SCALES.BALANCES.range = setTimeScaleRange(TIME_SCALES.BALANCES.range,
			TIME_SCALES.BALANCES.resolution, 'balances');
	
	HISTORY_INTERVALS.balances = SCALE_MILLIS['val_'+TIME_SCALES.BALANCES.resolution];
	
	if (LOADING.balances === STATES.READY) {
		LOADING.balances = STATES.LOADING;
		
		lastBalancesHistoryUpdate = new Date();
		
		disableTimeScaleButtons('balances');
		
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

function updateBalancesVisibility() {
	GRAPHS.historicalBalances.series[0].setVisible(SHOWING.BALANCES.confirmed);
	GRAPHS.historicalBalances.series[1].setVisible(SHOWING.BALANCES.unconverted);
	GRAPHS.historicalBalances.series[2].setVisible(SHOWING.BALANCES.sent);
}

function enableTimeScaleButtons(id) {
	$('#range_'+id+' button').not('.title').prop("disabled", false);
	$('#resolution_'+id+' button').not('.title').prop("disabled", false);
}

function disableTimeScaleButtons(id) {
	$('#range_'+id+' button').not('.title').prop("disabled", true);
	$('#resolution_'+id+' button').not('.title').prop("disabled", true);
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
	$('button[id="range_'+id+'_'+range +'"]').addClass('active').siblings().removeClass('active');

	$('button[id="resolution_'+id+'_'+resolution +'"]').addClass('active').siblings().removeClass('active');
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
		HISTORICAL_DATA.hashRate.push([ date.getTime(), khashrate ]);
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
		
		HISTORICAL_DATA.sent.push([ date.getTime(), data.balances.sent ]);
		HISTORICAL_DATA.confirmed.push([ date.getTime(), data.balances.confirmed ]);
		HISTORICAL_DATA.unconverted.push([ date.getTime(), data.balances.unconverted ]);
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

function doUpdate() {
	var lastAPICall = new Date().getTime() - lastUpdate.getTime();	
	
	if (lastAPICall >= apiInterval) {
		if (address != undefined && btcAddressRegex.test(address)) {
			updateAPI();
		}
	}
	
	// False to only update at specified resolution
	getHistoricalData(false);

	updateGUI();
}

function updateAPI() {
	lastUpdate = new Date();
	
	$.getJSON(currentURL + address, function(data) {
		if (data !== undefined && data.error == "" || data.error === undefined) {
			performVersionCheck(data);

			updateCurrentData(data);
		} else {
			showError('Remote Error', data.error);
		}
	}).error(function(err) {
		showError('Update Error', 'Local Server Unreachable');
	});
}

function updateGUI() {
	checkLoaded();
	updateValues();
}

function performVersionCheck(data) {
	var rcvdVersion = data.wafflesVersion;
	
	if (wafflesVersion === null) {
		wafflesVersion = rcvdVersion;
	} else {
		if (wafflesVersion !== rcvdVersion) {
			showVersionNotification();
		}
	}
}

function updateCurrentData(data) {
	if (cacheID != data.cacheID) {
		var date = new Date(data.createdAt);
		
		var formatted = formatAPIValues(data);
		
		DATA_RANGE.HASHRATE.lastValue = date;
		DATA_RANGE.BALANCES.lastValue = date;
		
		CURRENT_DATA.sent = formatted.balances.sent;
		CURRENT_DATA.confirmed = formatted.balances.confirmed;
		CURRENT_DATA.unconverted = formatted.balances.unconverted;
	
		var khashrate = formatted.hashRate / 1000.0;
		CURRENT_DATA.hashRate = khashrate;
		
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
		
		replotHistoricalGraph();
		
		hideHashRateLoading();
		enableTimeScaleButtons('hashrate');
	}
	
	if (LOADING.balances === STATES.LOADED) {
		LOADING.balances = STATES.READY;
		
		replotBalanceGraph();
		
		hideBalancesLoading();
		enableTimeScaleButtons('balances');
	}
}

function replotHistoricalGraph() {
	GRAPHS.historicalHashrate.series[0].setData(HISTORICAL_DATA.hashRate, false);
	GRAPHS.historicalHashrate.redraw();
}

function replotBalanceGraph() {
	GRAPHS.historicalBalances.series[0].setData(HISTORICAL_DATA.confirmed, false);
	GRAPHS.historicalBalances.series[1].setData(HISTORICAL_DATA.unconverted, false);
	GRAPHS.historicalBalances.series[2].setData(HISTORICAL_DATA.sent, false);
	GRAPHS.historicalBalances.redraw();
}

function reflowGraphs() {
	GRAPHS.historicalHashrate.reflow();
	GRAPHS.historicalBalances.reflow();
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
	
	setValue("#hashrate", sprintf(hashrateDecimalFormatString, CURRENT_DATA.hashRate));
	
	setValue("#sent", sprintf(bitcoinFormatString, CURRENT_DATA.sent));
	setValue("#confirmed", sprintf(bitcoinFormatString, CURRENT_DATA.confirmed));
	setValue("#unconverted", sprintf(bitcoinFormatString, CURRENT_DATA.unconverted));
	
	var totalUnsentBalance = CURRENT_DATA.confirmed + CURRENT_DATA.unconverted;
	setValue("#unsent", sprintf(bitcoinFormatString, totalUnsentBalance));

	if (lastUpdate.getTime() > 0) {
		setValue("#updated", lastUpdate.toLocaleString());
	} else {
		setValue("#updated", 'Never');
	}
}

function setValue(id, value, effect) {
	if (effect === undefined) {
		effect = true;
	}
	
	var oldValue = $(id).html();
	
	$(id).html(value);
	
	if (oldValue != value && effect) {
		$(id).delay(50);
		for(var i = 0; i < 4; i++) {
			$(id).animate({opacity: 0.0}, 200, 'linear')
				.animate({opacity: 1}, 200, 'linear');
		}
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
	
	if (histLength > 0) {
		min = HISTORICAL_DATA.hashRate[0][1];
		max = HISTORICAL_DATA.hashRate[0][1];
		
		for (var i = 0; i < histLength; i++) {
			var val = HISTORICAL_DATA.hashRate[i][1];
			min = Math.min(min, val);
			max = Math.max(max, val);
			sum += val;
		}
		
		average = sum / histLength;
	}
	
	setValue("#minimumHR", sprintf(hashrateFormatString, min));
	setValue("#averageHR", sprintf(hashrateFormatString, average));
	setValue("#maximumHR", sprintf(hashrateFormatString, max));
}

function showVersionNotification() {
	$.pnotify({
	    title: 'WAFFLEStats Updated',
	    text: 'Refresh this page to start using the latest version now!',
	    type: 'info',
	    icon: 'fa fa-arrow-up',
	    sticker: false,
	    closer_hover: false,
	    hide: true,
	    delay: 60*1000
	});
}

function showError(title, error, autoHide) {
	if(typeof(autoHide) === 'undefined') autoHide = true;
	$.pnotify({
	    title: title,
	    text: error,
	    type: 'error',
	    sticker: false,
	    closer_hover: false,
	    hide: autoHide,
	    delay: 30*1000
	});
}

function showHashRateLoading() {
	GRAPHS.historicalHashrate.showLoading();
}

function hideHashRateLoading() {
	GRAPHS.historicalHashrate.hideLoading();
}

function showBalancesLoading() {
	GRAPHS.historicalBalances.showLoading();
}

function hideBalancesLoading() {
	GRAPHS.historicalBalances.hideLoading();
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