var STATES = {
		// Used for History Loading State
		READY: 0,
		LOADING: 1,
		LOADED: 2,
};

var LOADING = {
	hashRate: STATES.READY,
	balances: STATES.READY,
	summary: STATES.READY
};

var HISTORICAL_DATA = {
	CHARTS : {
		hashRate : [],
		sent : [],
		unsent : [],
		confirmed : [],
		unconverted : [],
		payments: [],
		workers: {}
	},
	SUMMARY : {
		hashRate : [],
		sent : [],
		confirmed : [],
		unconverted : [],
		payments: [],
		workers: {}
	}
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
	},
	SUMMARY : {
		firstValue : new Date(),
		lastValue : new Date()
	}
};

var GRAPHS = {
	historicalHashrate : null,
	historicalBalances : null,
	summaryChart : null
};

var WORKER_HASHRATE_SERIES = {
		HASHRATE: {},
		HASHRATE_COUNT: 0,
		SUMMARY: {},
		SUMMARY_COUNT: 0
};

var SHOWING = {
	BALANCES : {
		confirmed: true,
		unconverted: true,
		unsent: true,
		sent: false,
		payments: true
	},
	HASHRATE : {
		hashrate: true,
		workers: {}
	},
	SUMMARY : {
		confirmed: true,
		unconverted: true,
		sent: false,
		payments: false,
		hashrate: true,
		workers: {}
	}
};

var TIME_SCALES = {
	HASHRATE : {
		resolution: '1hr',
		range: '1day'
	},
	BALANCES : {
		resolution: '1hr',
		range: '1wk'
	},
	SUMMARY : {
		resolution: '1hr',
		range: '3day'
	}
};

var SCALE_MILLIS = {
	val_1min: 1000*60,
	val_5min: 1000*60*5,
	val_30min: 1000*60*30,
	val_1hr: 1000*60*60,
	val_6hr: 1000*60*60*6,
	val_12hr: 1000*60*60*12,
	val_24hr: 1000*60*60*24,
	val_1day: 1000*60*60*24,
	val_3day: 1000*60*60*24*3,
	val_1wk: 1000*60*60*24*7,
	val_2wk: 1000*60*60*24*7*2,
	val_1mo: 1000*60*60*24*7*4,
};

var HISTORY_INTERVALS = {
	hashRate: SCALE_MILLIS['val_'+TIME_SCALES.HASHRATE.resolution],
	balances: SCALE_MILLIS['val_'+TIME_SCALES.BALANCES.resolution],
	summary: SCALE_MILLIS['val_'+TIME_SCALES.SUMMARY.resolution]
};

var DETAILS_STRING = {
	val_1hr : "Last Hour",
	val_6hr : "Last 6 Hours",
	val_12hr : "Last 12 Hours",
	val_24hr : "Last 24 Hours",
	val_3day : "Last 3 Days",
	val_7day : "Last 7 Days",
	val_lifetime : "Lifetime"
};

var DETAILS_RANGE = "24hr";

var PREFERENCES = {
	VIEW_MODE: 'view_mode',
	TIME_SCALES: 'time_scales',
	SHOWING: 'showing'
};

// Last API and History Update
var lastUpdate = new Date(0);
var lastHashrateHistoryUpdate = new Date(0);
var lastBalancesHistoryUpdate = new Date(0);
var lastSummaryUpdate = new Date(0);

// Last result cacheID
var cacheID = null;

// Storage for initial running version
var wafflesVersion = null;

// API proxy address and Bitcoin address
var currentURL = '/current/%s'; // /current/{btcAddr}
var summaryURL = '/historical/v2/%s/%s/%s'; // /historical/hashRate/{btcAddr}/{resolution}/{range}
var historicalHashRateURL = '/historical/v2/hashRate/%s/%s/%s'; // /historical/hashRate/{btcAddr}/{resolution}/{range}
var historicalBalancesURL = '/historical/v2/balances/%s/%s/%s'; // /historical/balances/{btcAddr}/{resolution}/{range}
var paymentsURL = '/payments/%s'; // /payments/{btcAddr}
var statisticsURL = '/statistics/%s/%s'; // /payments/{btcAddr}/{range}
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
var titleFormatString = "%s - WAFFLEStats";

// Regex to test bitcoin addresses before pinging for current data
// Disabled for historical data so I can test locally using historical data
var btcAddressRegex = /^[13][1-9A-HJ-NP-Za-km-z]{26,33}/;

var THEMES = {
	"daytime" : {
		css: "//netdna.bootstrapcdn.com/bootstrap/3.1.0/css/bootstrap.min.css",
		charts: {}
	},
	"nighttime" : {
		css: "//netdna.bootstrapcdn.com/bootswatch/3.1.1/slate/bootstrap.min.css",
		charts: {} // Defined at bottom of file
	}
};

var currentTheme = "daytime";

// Disable caching of AJAX responses, hopefully fixes IE?
$.ajaxSetup({
	cache : false
});

$(document).ready(function() {
	
	loadPreferences();
	
	setDefaults();

	// Grab Bitcoin address
	address = $.url().param('address');
	
	if (address === undefined) {
		window.location.replace('/');
		return;
	} else if (address !== undefined) {
		// Trim spaces
		address = address.trim();
		
		// Regex test
		if (!btcAddressRegex.test(address)) {
			showError('BTC Address Error',
					"Address didn't pass regex check and thus appears invalid. This does not mean it IS invalid, however. " +
					"If this is incorrect, please contact administrator.",
					false);
		}
		
		$('#btcAddress').val(address);
		$('#notifications').attr("href", "/notifications/"+address);
	}
	
	initGUI();
		
	initGraphs();
	
	reflowGraphs();

	getHistoricalData(true);

	startInterval();
});

$( window ).unload(function() {
	saveBalancesVisibility();
	saveHashrateVisibility();
	saveSummaryVisibility();
});

$( window ).resize(function() {
	reflowGraphs();
});

function loadPreferences() {
	// Set prefered view mode
	if (getPreference(PREFERENCES.VIEW_MODE)) {
		currentTheme = getPreference(PREFERENCES.VIEW_MODE);
	}
	
	// Set prefered ranges and resolutions
	if (getPreference(PREFERENCES.TIME_SCALES)) {
		TIME_SCALES = JSON.parse(getPreference(PREFERENCES.TIME_SCALES));
	}
	
	// Set visibility preferences
	if (getPreference(PREFERENCES.SHOWING)) {
		SHOWING = JSON.parse(getPreference(PREFERENCES.SHOWING));
	}
}

function setDefaults() {
	$.pnotify.defaults.history = false;
	$.pnotify.defaults.styling = "bootstrap3";
	
	Highcharts.setOptions({
        global : {
            useUTC : false
        }
    });
}

function initGUI() {
	// Set theme
	$('#theme').attr('href', THEMES[currentTheme].css);
	
	$('.summaryTab').click(function() {
		setTimeout(function() {
			reflowGraphs();
		}, 200);
	});
	
	$('.chartsTab').click(function() {
		setTimeout(function() {
			reflowGraphs();
		}, 200);
	});

	$('.theme-link').click(function() {
		currentTheme = $(this).attr('data-theme');
		
		setPreference(PREFERENCES.VIEW_MODE, currentTheme);
		
		var themeurl = THEMES[currentTheme].css;
		
		setTimeout(function () {
			$('#theme').attr('href', themeurl);
			
			initGraphs();
			replotHashrateGraph();
			replotBalanceGraph();
			replotSummaryChart();
			
			reflowGraphs();
		}, 1);
	});
	
	$('.detailsTab').click(function () {
		updatePaymentDetails();
	});
	
	$('.detailsRange').click(function () {
		DETAILS_RANGE = $(this).data('range');
		updateDetails();
	});
	
	$('#resolution_hashrate button').click(function (e) {
		if (LOADING.hashRate === STATES.READY) {
			var value = $(this).val();
			
			if (value !== undefined) {
				value = value.trim();
				TIME_SCALES.HASHRATE.resolution = value;
				setPreference(PREFERENCES.TIME_SCALES, JSON.stringify(TIME_SCALES));
				updateHashRateHistory();
			}
		}
		e.preventDefault();
	});
	
	$('#range_hashrate button').click(function (e) {
		if (LOADING.hashRate === STATES.READY) {
			var value = $(this).val();
			
			if (value !== undefined) {
				value = value.trim();
				TIME_SCALES.HASHRATE.range = value;
				setPreference(PREFERENCES.TIME_SCALES, JSON.stringify(TIME_SCALES));
				updateHashRateHistory();
			}
		}
		e.preventDefault();
	});
	
	$('#resolution_balances button').click(function (e) {
		if (LOADING.balances === STATES.READY) {
			var value = $(this).val();
			
			if (value !== undefined) {
				value = value.trim();
				TIME_SCALES.BALANCES.resolution = value;
				setPreference(PREFERENCES.TIME_SCALES, JSON.stringify(TIME_SCALES));
				updateBalancesHistory();
			}
		}
		e.preventDefault();
	});
	
	$('#range_balances button').click(function (e) {
		if (LOADING.balances === STATES.READY) {
			var value = $(this).val();
			
			if (value !== undefined) {
				value = value.trim();
				TIME_SCALES.BALANCES.range = value;
				setPreference(PREFERENCES.TIME_SCALES, JSON.stringify(TIME_SCALES));
				updateBalancesHistory();
			}
		}
		e.preventDefault();
	});
	
	$('#resolution_summary button').click(function (e) {
		if (LOADING.summary === STATES.READY) {
			var value = $(this).val();
			
			if (value !== undefined) {
				value = value.trim();
				TIME_SCALES.SUMMARY.resolution = value;
				setPreference(PREFERENCES.TIME_SCALES, JSON.stringify(TIME_SCALES));
				updateSummary();
			}
		}
		e.preventDefault();
	});
	
	$('#range_summary button').click(function (e) {
		if (LOADING.summary === STATES.READY) {
			var value = $(this).val();
			
			if (value !== undefined) {
				value = value.trim();
				TIME_SCALES.SUMMARY.range = value;
				setPreference(PREFERENCES.TIME_SCALES, JSON.stringify(TIME_SCALES));
				updateSummary();
			}
		}
		e.preventDefault();
	});
}

function initGraphs() {
	if (GRAPHS.historicalHashrate) {
		saveHashrateVisibility();
		clearHistoricalHashRateWorkerSummaries();
		GRAPHS.historicalHashrate.destroy();
	}
	
	if (GRAPHS.historicalBalances) {
		saveBalancesVisibility();
		GRAPHS.historicalBalances.destroy();
	}
	
	if (GRAPHS.summaryChart) {
		saveSummaryVisibility();
		clearSummaryWorkerSeries();
		GRAPHS.summaryChart.destroy();
	}

	// Create hashrate graph
	$('#historalHashrate').highcharts($.extend(true, {}, THEMES[currentTheme].charts, lineChartDefaults, historicalHashrateLineChart));
	GRAPHS.historicalHashrate = $('#historalHashrate').highcharts();
	updateHashrateVisibility();
	
	// Create balances graph
	$('#historicalBalances').highcharts($.extend(true, {}, THEMES[currentTheme].charts, lineChartDefaults, historicalBalanceLineChart));
	GRAPHS.historicalBalances = $('#historicalBalances').highcharts();
	updateBalancesVisibility();
	
	// Create summary graph
	$('#summaryChart').highcharts($.extend(true, {}, THEMES[currentTheme].charts, summaryChart));
	GRAPHS.summaryChart = $('#summaryChart').highcharts();
	updateSummaryVisibility();
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
	
	var lastSummaryCall = new Date().getTime() - lastSummaryUpdate.getTime();
	if (force || lastSummaryCall >= HISTORY_INTERVALS.summary) {
		updateSummary();
	}
}

function unloadData() {
	clearHistoricalHashRate();
	clearHistoricalBalances();
	clearSummary();
}

function updateHashRateHistory() {
	TIME_SCALES.HASHRATE.range = setTimeScaleRange(TIME_SCALES.HASHRATE.range,
			TIME_SCALES.HASHRATE.resolution, 'hashrate');

	HISTORY_INTERVALS.hashRate = SCALE_MILLIS['val_'
			+ TIME_SCALES.HASHRATE.resolution];

	if (LOADING.hashRate === STATES.READY) {
		LOADING.hashRate = STATES.LOADING;

		lastHashrateHistoryUpdate = new Date();

		disableTimeScaleButtons('hashrate');

		showHashRateLoading();

		var url = sprintf(historicalHashRateURL, address, TIME_SCALES.HASHRATE.resolution, TIME_SCALES.HASHRATE.range);
		
		$.ajax({
			url : url,
			dataType : 'json',
			success : function(history) {
				if (history) {
					processHistoricalHashRate(history);
				}
				LOADING.hashRate = STATES.LOADED;
			},
			timeout : 60000, // 60 second timeout
			error : function(jqXHR, status, errorThrown) {
				LOADING.hashRate = STATES.LOADED;
			}
		});
	}

	updateTimeScales(TIME_SCALES.HASHRATE.range,
			TIME_SCALES.HASHRATE.resolution, 'hashrate');
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
		
		$.ajax({
			url : url,
			dataType : 'json',
			success : function(history) {
				if (history) {
					processHistoricalBalances(history);
				}
				LOADING.balances = STATES.LOADED;
			},
			timeout : 60000, // 60 second timeout
			error : function(jqXHR, status, errorThrown) {
				LOADING.balances = STATES.LOADED;
			}
		});
	}
	
	updateTimeScales(TIME_SCALES.BALANCES.range, TIME_SCALES.BALANCES.resolution, 'balances');
}

function updateSummary() {
	TIME_SCALES.SUMMARY.range = setTimeScaleRange(TIME_SCALES.SUMMARY.range,
			TIME_SCALES.SUMMARY.resolution, 'summary');
	
	HISTORY_INTERVALS.summary = SCALE_MILLIS['val_'+TIME_SCALES.SUMMARY.resolution];
	
	if (LOADING.summary === STATES.READY) {
		LOADING.summary = STATES.LOADING;
		
		lastSummaryUpdate = new Date();
		
		disableTimeScaleButtons('summary');
		
		saveSummaryVisibility();
		
		showSummaryLoading();
		
		var url = sprintf(summaryURL, address, TIME_SCALES.SUMMARY.resolution, TIME_SCALES.SUMMARY.range);

		$.ajax({
			url : url,
			dataType : 'json',
			success : function(history) {
				if (history) {
					processSummaryData(history);
				}
				LOADING.summary = STATES.LOADED;
			},
			timeout : 60000, // 60 second timeout
			error : function(jqXHR, status, errorThrown) {
				LOADING.summary = STATES.LOADED;
			}
		});
	}
	
	updateTimeScales(TIME_SCALES.SUMMARY.range, TIME_SCALES.SUMMARY.resolution, 'summary');
}

function saveHashrateVisibility() {
	SHOWING.HASHRATE.hashrate = GRAPHS.historicalHashrate.series[0].visible;
	
	for (var username in WORKER_HASHRATE_SERIES.HASHRATE) {
		SHOWING.HASHRATE.workers[username] = WORKER_HASHRATE_SERIES.HASHRATE[username].visible;
	}
	
	setPreference(PREFERENCES.SHOWING, JSON.stringify(SHOWING));
}

function updateHashrateVisibility() {
	GRAPHS.historicalHashrate.series[0].setVisible(SHOWING.HASHRATE.hashrate);
	
	for (var username in WORKER_HASHRATE_SERIES.HASHRATE) {
		var showing = true; // Default workers to showing
		
		if (SHOWING.HASHRATE.workers.hasOwnProperty(username)) {
			showing = SHOWING.HASHRATE.workers[username];
		}
		
		WORKER_HASHRATE_SERIES.HASHRATE[username].setVisible(showing);
	}
}

function saveBalancesVisibility() {
	SHOWING.BALANCES.unconverted = GRAPHS.historicalBalances.series[0].visible;
	SHOWING.BALANCES.confirmed = GRAPHS.historicalBalances.series[1].visible;
	SHOWING.BALANCES.unsent = GRAPHS.historicalBalances.series[2].visible;
	SHOWING.BALANCES.sent = GRAPHS.historicalBalances.series[3].visible;
	SHOWING.BALANCES.payments = GRAPHS.historicalBalances.series[4].visible;
	
	setPreference(PREFERENCES.SHOWING, JSON.stringify(SHOWING));
}

function updateBalancesVisibility() {
	GRAPHS.historicalBalances.series[0].setVisible(SHOWING.BALANCES.unconverted);
	GRAPHS.historicalBalances.series[1].setVisible(SHOWING.BALANCES.confirmed);
	GRAPHS.historicalBalances.series[2].setVisible(SHOWING.BALANCES.unsent);
	GRAPHS.historicalBalances.series[3].setVisible(SHOWING.BALANCES.sent);
	GRAPHS.historicalBalances.series[4].setVisible(SHOWING.BALANCES.payments);
}

function saveSummaryVisibility() {
	SHOWING.SUMMARY.sent = GRAPHS.summaryChart.series[0].visible;
	SHOWING.SUMMARY.unconverted = GRAPHS.summaryChart.series[1].visible;
	SHOWING.SUMMARY.confirmed = GRAPHS.summaryChart.series[2].visible;
	SHOWING.SUMMARY.payments = GRAPHS.summaryChart.series[3].visible;
	SHOWING.SUMMARY.hashrate = GRAPHS.summaryChart.series[4].visible;
	
	for (var username in WORKER_HASHRATE_SERIES.SUMMARY) {
		SHOWING.SUMMARY.workers[username] = WORKER_HASHRATE_SERIES.SUMMARY[username].visible;
	}
	
	setPreference(PREFERENCES.SHOWING, JSON.stringify(SHOWING));
}

function updateSummaryVisibility() {
	GRAPHS.summaryChart.series[0].setVisible(SHOWING.SUMMARY.sent);
	GRAPHS.summaryChart.series[1].setVisible(SHOWING.SUMMARY.unconverted);
	GRAPHS.summaryChart.series[2].setVisible(SHOWING.SUMMARY.confirmed);
	GRAPHS.summaryChart.series[3].setVisible(SHOWING.SUMMARY.payments);
	GRAPHS.summaryChart.series[4].setVisible(SHOWING.SUMMARY.hashrate);
	
	for (var username in WORKER_HASHRATE_SERIES.SUMMARY) {
		var showing = false; // Default workers to hidden
		
		if (SHOWING.SUMMARY.workers.hasOwnProperty(username)) {
			showing = SHOWING.SUMMARY.workers[username];
		}
		
		WORKER_HASHRATE_SERIES.SUMMARY[username].setVisible(showing);
	}
}

function enableTimeScaleButtons(id) {
	$('#range_'+id+' button').not('.header').prop("disabled", false);
	$('#resolution_'+id+' button').not('.header').prop("disabled", false);
}

function disableTimeScaleButtons(id) {
	$('#range_'+id+' button').not('.header').prop("disabled", true);
	$('#resolution_'+id+' button').not('.header').prop("disabled", true);
}

function setTimeScaleRange(range, resolution, id) {
	if (resolution == '1hr' || resolution == '1day') {
		if ($.inArray(range, ['1hr', '6hr', '12hr', '24hr']) !== -1) {
			range = '1day';
		}
		$("#range_" + id + ' .smallRange').hide();
		$("#range_" + id + ' .largeRange').show();
	} else {
		if ($.inArray(range, ['1day', '3day', '1wk', '2wk']) !== -1) {
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
	if (history.global) {
		var histLen = history.global.length;
		
		clearHistoricalHashRate();
	
		for (var i = 0; i < histLen; i++) {
			var data = history.global[i];
			var date = new Date(data.createdAt);
			
			if (date.getTime() < DATA_RANGE.HASHRATE.firstValue.getTime()) {
				DATA_RANGE.HASHRATE.firstValue = date;
			}
			
			if (date.getTime() > DATA_RANGE.HASHRATE.lastValue.getTime()) {
				DATA_RANGE.HASHRATE.lastValue = date;
			}
	
			var khashrate = data.hashrate / 1000.0;
			HISTORICAL_DATA.CHARTS.hashRate.push([ date.getTime(), khashrate ]);
		}
	}
	
	// Process workers
	if (history.workers) {
		var workerListLen = history.workers.length;
		
		for (var w = 0; w < workerListLen; w++) {
			var workerListData = history.workers[w];
			
			var date = new Date(workerListData._id);
			
			var workerLen = workerListData.workers.length;
			
			for (var i = 0; i < workerLen; i++) {
				var workerData = workerListData.workers[i];
				
				var username = workerData._id;
				var hashrate = workerData.hashrate;
				var khashrate = hashrate / 1000.0;
				
				// Create the data object if it doesn't exist yet
				if (!HISTORICAL_DATA.CHARTS.workers.hasOwnProperty(username)) {
					HISTORICAL_DATA.CHARTS.workers[username] = [];
				}
				
				HISTORICAL_DATA.CHARTS.workers[username].push([date.getTime(), khashrate]);
			}
		}
	}
}

function processHistoricalBalances(history) {
	if (history.global) {
		var histLen = history.global.length;
	
		clearHistoricalBalances();
		
		for (var i = 0; i < histLen; i++) {
			var data = history.global[i];
	
			var date = new Date(data.createdAt);
			
			if (date.getTime() < DATA_RANGE.BALANCES.firstValue.getTime()) {
				DATA_RANGE.BALANCES.firstValue = date;
			}
			
			if (date.getTime() > DATA_RANGE.BALANCES.lastValue.getTime()) {
				DATA_RANGE.BALANCES.lastValue = date;
			}
			
			HISTORICAL_DATA.CHARTS.sent.push([ date.getTime(), data.balances.sent ]);
			HISTORICAL_DATA.CHARTS.unsent.push([ date.getTime(), data.balances.confirmed + data.balances.unconverted ]);
			HISTORICAL_DATA.CHARTS.confirmed.push([ date.getTime(), data.balances.confirmed ]);
			HISTORICAL_DATA.CHARTS.unconverted.push([ date.getTime(), data.balances.unconverted ]);
		}
	}
	
	// Process payments
	if (history.payments) {
		var payLen = history.payments.length;
		for (var p = 0; p < payLen; p++) {
			var payment = history.payments[p];
			var date = new Date(payment.time);
			
			HISTORICAL_DATA.CHARTS.payments.push([ date.getTime(), getFloat(payment.amount) ]);
		}
	}
}

function processSummaryData(history) {
	if (history.global) {
		var histLen = history.global.length;
		
		clearSummary();
		
		for (var i = 0; i < histLen; i++) {
			var data = history.global[i];
			
			var date = new Date(data.createdAt);
			
			if (date.getTime() < DATA_RANGE.SUMMARY.firstValue.getTime()) {
				DATA_RANGE.SUMMARY.firstValue = date;
			}
			
			if (date.getTime() > DATA_RANGE.SUMMARY.lastValue.getTime()) {
				DATA_RANGE.SUMMARY.lastValue = date;
			}
			
			var khashrate = data.hashrate / 1000.0;
			HISTORICAL_DATA.SUMMARY.hashRate.push([ date.getTime(), khashrate ]);
			
			HISTORICAL_DATA.SUMMARY.sent.push([ date.getTime(), data.balances.sent ]);
			HISTORICAL_DATA.SUMMARY.confirmed.push([ date.getTime(), data.balances.confirmed ]);
			HISTORICAL_DATA.SUMMARY.unconverted.push([ date.getTime(), data.balances.unconverted ]);
		}
	}
	
	// Process workers
	if (history.workers) {
		var workerListLen = history.workers.length;
		
		for (var w = 0; w < workerListLen; w++) {
			var workerListData = history.workers[w];
			
			var date = new Date(workerListData._id);
			
			var workerLen = workerListData.workers.length;
			
			for (var i = 0; i < workerLen; i++) {
				var workerData = workerListData.workers[i];
				
				var username = workerData._id;
				var hashrate = workerData.hashrate;
				var khashrate = hashrate / 1000.0;
				
				// Create the data object if it doesn't exist yet
				if (!HISTORICAL_DATA.SUMMARY.workers.hasOwnProperty(username)) {
					HISTORICAL_DATA.SUMMARY.workers[username] = [];
				}
				
				HISTORICAL_DATA.SUMMARY.workers[username].push([date.getTime(), khashrate]);
			}
		}
	}

	//Process payments
	if (history.payments) {
		var payLen = history.payments.length;
		for (var p = 0; p < payLen; p++) {
			var payment = history.payments[p];
			var date = new Date(payment.time);
			
			HISTORICAL_DATA.SUMMARY.payments.push([ date.getTime(), getFloat(payment.amount) ]);
		}
	}
}

function getShortUsername(username) {
	var split = username.split('_');
	
	if (split.length > 1) {
		return split[split.length-1];
	}
	
	var usernameLength = username.length;
	
	if (usernameLength > 8) {
		usernameLength = 8;
	} else if (usernameLength < 8) {
		usernameLength = usernameLength - 1;
	}
	
	return username.substring(0, usernameLength); 
}

function convertUTCDateToLocalDate(date) {
    var newDate = new Date(date.getTime()+date.getTimezoneOffset()*60*1000);

    var offset = date.getTimezoneOffset() / 60;
    var hours = date.getHours();

    newDate.setHours(hours - offset);

    return newDate;   
}

function clearHistoricalHashRate() {
	DATA_RANGE.HASHRATE.firstValue = new Date();
	//DATA_RANGE.HASHRATE.lastValue = new Date();
	
	HISTORICAL_DATA.CHARTS.hashRate = [];
	HISTORICAL_DATA.CHARTS.workers = {};
}

function clearHistoricalHashRateWorkerSummaries() {
	// Clear the series' generated for worker data
	for (var username in WORKER_HASHRATE_SERIES.HASHRATE) {
		WORKER_HASHRATE_SERIES.HASHRATE[username].remove(false);
	}
	WORKER_HASHRATE_SERIES.HASHRATE = {};
	WORKER_HASHRATE_SERIES.HASHRATE_COUNT = 0;
}

function clearHistoricalBalances() {
	DATA_RANGE.BALANCES.firstValue = new Date();
	//DATA_RANGE.BALANCES.lastValue = new Date();
	
	HISTORICAL_DATA.CHARTS.sent = [];
	HISTORICAL_DATA.CHARTS.unsent = [];
	HISTORICAL_DATA.CHARTS.confirmed = [];
	HISTORICAL_DATA.CHARTS.unconverted = [];
	HISTORICAL_DATA.CHARTS.payments = [];
}

function clearSummary() {
	DATA_RANGE.SUMMARY.firstValue = new Date();
	//DATA_RANGE.BALANCES.lastValue = new Date();
	
	HISTORICAL_DATA.SUMMARY.sent = [];
	HISTORICAL_DATA.SUMMARY.confirmed = [];
	HISTORICAL_DATA.SUMMARY.unconverted = [];
	HISTORICAL_DATA.SUMMARY.payments = [];
	HISTORICAL_DATA.SUMMARY.hashRate = [];
	HISTORICAL_DATA.SUMMARY.workers = {};
}

function clearSummaryWorkerSeries() {
	// Clear the series' generated for worker data
	for (var username in WORKER_HASHRATE_SERIES.SUMMARY) {
		WORKER_HASHRATE_SERIES.SUMMARY[username].remove(false);
	}
	WORKER_HASHRATE_SERIES.SUMMARY = {};
	WORKER_HASHRATE_SERIES.SUMMARY_COUNT = 0;
}

function doUpdate() {
	var lastAPICall = new Date().getTime() - lastUpdate.getTime();	
	
	if (lastAPICall >= apiInterval) {
		if (address != undefined && btcAddressRegex.test(address)) {
			updateAPI();
			updateDetails();
		}
	}
	
	// False to only update at specified resolution
	getHistoricalData(false);

	updateGUI();
}

function updateAPI() {
	lastUpdate = new Date();
	
	var url = sprintf(currentURL, address);
	
	$.getJSON(url, function(data) {
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
		var formatted = formatAPIValues(data);
		
		CURRENT_DATA.sent = formatted.balances.sent;
		CURRENT_DATA.confirmed = formatted.balances.confirmed;
		CURRENT_DATA.unconverted = formatted.balances.unconverted;
	
		CURRENT_DATA.hashRate = formatted.hashRate ;
		
		cacheID = data.cacheID;
	}
}

function formatAPIValues(data) {
	return {
		hashRate: parseInt(data.hash_rate),
		balances: {
			sent: getFloat(data.balances.sent),
			confirmed: getFloat(data.balances.confirmed),
			unconverted: getFloat(data.balances.unconverted)
		}
	};
}

function getFloat(stringVal) {
	if (typeof stringVal === 'string') {
		return parseFloat( stringVal.replace(/,/g,'') );
	} else {
		return parseFloat( stringVal );
	}
}

function checkLoaded() {
	if (LOADING.hashRate === STATES.LOADED) {
		LOADING.hashRate = STATES.READY;
		
		clearHistoricalHashRateWorkerSummaries();
		
		replotHashrateGraph();
		
		hideHashRateLoading();
		enableTimeScaleButtons('hashrate');
	}
	
	if (LOADING.balances === STATES.LOADED) {
		LOADING.balances = STATES.READY;
		
		replotBalanceGraph();
		replotSummaryChart();
		
		hideBalancesLoading();
		enableTimeScaleButtons('balances');
	}
	
	if (LOADING.summary === STATES.LOADED) {
		LOADING.summary = STATES.READY;
		
		clearSummaryWorkerSeries();
		
		replotSummaryChart();
		
		hideSummaryLoading();
		enableTimeScaleButtons('summary');
	}
}

function replotHashrateGraph() {
	GRAPHS.historicalHashrate.series[0].setData(HISTORICAL_DATA.CHARTS.hashRate, false);
	
	// Set worker data
	for (var username in HISTORICAL_DATA.CHARTS.workers) {
		// Create the series if it doesn't exist
		if (!WORKER_HASHRATE_SERIES.HASHRATE.hasOwnProperty(username)) {
			var options = {
					name: getShortUsername(username),
					color: getSeriesColor(WORKER_HASHRATE_SERIES.HASHRATE_COUNT++, 8)
			};
			WORKER_HASHRATE_SERIES.HASHRATE[username] = GRAPHS.historicalHashrate.addSeries($.extend(true, {}, WORKER_SERIES_BASE.HASHRATE_CHART, options), false, false);
		}
		
		var series = WORKER_HASHRATE_SERIES.HASHRATE[username];
		var data = HISTORICAL_DATA.CHARTS.workers[username];
		
		series.setData(data, false);
	}
	
	updateHashrateVisibility();
	
	GRAPHS.historicalHashrate.redraw();
}

function replotBalanceGraph() {
	GRAPHS.historicalBalances.series[0].setData(HISTORICAL_DATA.CHARTS.unconverted, false);
	GRAPHS.historicalBalances.series[1].setData(HISTORICAL_DATA.CHARTS.confirmed, false);
	GRAPHS.historicalBalances.series[2].setData(HISTORICAL_DATA.CHARTS.unsent, false);
	GRAPHS.historicalBalances.series[3].setData(HISTORICAL_DATA.CHARTS.sent, false);
	GRAPHS.historicalBalances.series[4].setData(HISTORICAL_DATA.CHARTS.payments, false);
	GRAPHS.historicalBalances.redraw();
}

function replotSummaryChart() {
	GRAPHS.summaryChart.series[0].setData(HISTORICAL_DATA.SUMMARY.sent, false);
	GRAPHS.summaryChart.series[1].setData(HISTORICAL_DATA.SUMMARY.unconverted, false);
	GRAPHS.summaryChart.series[2].setData(HISTORICAL_DATA.SUMMARY.confirmed, false);
	GRAPHS.summaryChart.series[3].setData(HISTORICAL_DATA.SUMMARY.payments, false);
	GRAPHS.summaryChart.series[4].setData(HISTORICAL_DATA.SUMMARY.hashRate, false);
	
	// Set worker data
	for (var username in HISTORICAL_DATA.SUMMARY.workers) {
		// Create the series if it doesn't exist
		if (!WORKER_HASHRATE_SERIES.SUMMARY.hasOwnProperty(username)) {
			var options = {
					name: getShortUsername(username),
					color: getSeriesColor(WORKER_HASHRATE_SERIES.SUMMARY_COUNT++, 8)
			};
			WORKER_HASHRATE_SERIES.SUMMARY[username] = GRAPHS.summaryChart.addSeries($.extend(true, {}, WORKER_SERIES_BASE.SUMMARY, options), false, false);
		}
		
		var series = WORKER_HASHRATE_SERIES.SUMMARY[username];
		var data = HISTORICAL_DATA.SUMMARY.workers[username];
		
		series.setData(data, false);
	}
	
	updateSummaryVisibility();
	
	GRAPHS.summaryChart.redraw();
}

function reflowGraphs() {
	GRAPHS.historicalHashrate.reflow();
	GRAPHS.historicalBalances.reflow();
	GRAPHS.summaryChart.reflow();
	
	GRAPHS.summaryChart.setSize(GRAPHS.summaryChart.width, $(window).height() - 180);
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
	
	var formattedHashrate = formatHashrate(CURRENT_DATA.hashRate);
	
	// For charts page
	setValue(".hashrateValue", formattedHashrate.valueStr);
	$(".hashrateAbbr").prop('title', formattedHashrate.desc);
	$(".hashrateAbbr").html(formattedHashrate.shortRateStr);
	
	// For elsehwere
	setValue(".hashrate", formattedHashrate.shortValueStr);
	
	document.title = sprintf(titleFormatString, formattedHashrate.shortValueStr);
	
	setValue(".sentValue", sprintf(bitcoinFormatString, CURRENT_DATA.sent));
	setValue(".confirmedValue", sprintf(bitcoinFormatString, CURRENT_DATA.confirmed));
	setValue(".unconvertedValue", sprintf(bitcoinFormatString, CURRENT_DATA.unconverted));
	
	var totalUnsentBalance = CURRENT_DATA.confirmed + CURRENT_DATA.unconverted;
	setValue(".unsentValue", sprintf(bitcoinFormatString, totalUnsentBalance));

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
	
	var histLength = HISTORICAL_DATA.CHARTS.hashRate.length;
	
	if (histLength > 0) {
		min = HISTORICAL_DATA.CHARTS.hashRate[0][1];
		max = HISTORICAL_DATA.CHARTS.hashRate[0][1];
		
		for (var i = 0; i < histLength; i++) {
			var val = HISTORICAL_DATA.CHARTS.hashRate[i][1];
			min = Math.min(min, val);
			max = Math.max(max, val);
			sum += val;
		}
		
		average = sum / histLength;
	}
	
	setValue(".minimumHR", sprintf(hashrateFormatString, min));
	setValue(".averageHR", sprintf(hashrateFormatString, average));
	setValue(".maximumHR", sprintf(hashrateFormatString, max));
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

function showSummaryLoading() {
	GRAPHS.summaryChart.showLoading();
}

function hideSummaryLoading() {
	GRAPHS.summaryChart.hideLoading();
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

function updateDetails() {
	var url = sprintf(statisticsURL, address,  DETAILS_RANGE);
	
	$.ajax({
		url : url,
		dataType : 'json',
		success : function(data) {
			fillDetails(data);
		},
		timeout : 60000, // 60 second timeout
		error : function(jqXHR, status, errorThrown) {
			console.log("Error when loading payments table data: " + errorThrown);
		}
	});
}

function fillDetails(data) {
	if (data && data.success) {
		$("#detailsRangeStr").html(DETAILS_STRING['val_' + DETAILS_RANGE]);

		setValue(".avgHashrate", formatHashrate(data.avgHashrate).shortValueStr);
		setValue(".minHashrate", formatHashrate(data.minHashrate).shortValueStr);
		setValue(".maxHashrate", formatHashrate(data.maxHashrate).shortValueStr);
		
		setValue(".amountEarned", sprintf(bitcoinFormatString, data.totalEarned));
		setValue(".btcPerHour", sprintf(bitcoinFormatString, data.btcPerHour));
		setValue(".btcPerDay", sprintf(bitcoinFormatString, data.btcPerDay));
		setValue(".btcPerDayPerMhash", sprintf(bitcoinFormatString, data.btcPerDayPerMhash));
	}
}

function updatePaymentDetails() {
	var url = sprintf(paymentsURL, address);

	$.ajax({
		url : url,
		dataType : 'json',
		success : function(data) {
			fillPaymentDetails(data);
		},
		timeout : 60000, // 60 second timeout
		error : function(jqXHR, status, errorThrown) {
			console.log("Error when loading payments table data: " + errorThrown);
		}
	});
}

function fillPaymentDetails(data) {
	var rowHTML = "<tr class=\"text-center\"><td><i class=\"fa fa-btc\"/>&nbsp;<span>%s</span></td><td>%s</td><td>%s</td></tr>";
	
	$('#paymentHistory > tbody').empty();
	
	var dataLength = data.length;
	for (var i = 0; i < dataLength; i++) {
		var payment = data[i];
		
		var append = sprintf(rowHTML, payment.amount, new Date(payment.time).toLocaleString(), payment.txn);
		
		$('#paymentHistory > tbody:last').append(append);
	}
}

function formatHashrate(rawHR) {
	var results = {
			rawHashrate: rawHR
	};
	
	if (rawHR < 1000) {
		results["valueStr"] = sprintf(hashrateDecimalFormatString, rawHR);
		results["shortRateStr"] = "h/s";
		results["longRateStr"] = "hash/s";
		results["desc"] = "hashes per second";
	} else if (rawHR < 1000 * 1000) {
		results["valueStr"] = sprintf(hashrateDecimalFormatString, rawHR / 1000);
		results["shortRateStr"] = "kH/s";
		results["longRateStr"] = "kHash/s";
		results["desc"] = "kilohashes per second";
	} else if (rawHR < 1000 * 1000 * 1000) {
		results["valueStr"] = sprintf(hashrateDecimalFormatString, rawHR / 1000 / 1000);
		results["shortRateStr"] = "MH/s";
		results["longRateStr"] = "MHash/s";
		results["desc"] = "megahashes per second";
	} else {
		results["valueStr"] = sprintf(hashrateDecimalFormatString, rawHR / 1000 / 1000 / 1000);
		results["shortRateStr"] = "GH/s";
		results["longRateStr"] = "GHash/s";
		results["desc"] = "gigahashes per second";
	}
	
	results["shortValueStr"] = results["valueStr"] + ' ' + results["shortRateStr"];
	results["longValueStr"] = results["valueStr"] + ' ' + results["longRateStr"];
	
	return results;
}

function setPreference(preference, value) {
	$.cookie(preference, value, {expires: 365});
}

function getPreference(preference) {
	return $.cookie(preference);
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

/* accepts parameters
 * h  Object = {h:x, s:y, v:z}
 * OR 
 * h, s, v
*/
function HSVtoRGB(h, s, v) {
    var r, g, b, i, f, p, q, t;
    if (h && s === undefined && v === undefined) {
        s = h.s, v = h.v, h = h.h;
    }
    i = Math.floor(h * 6);
    f = h * 6 - i;
    p = v * (1 - s);
    q = v * (1 - f * s);
    t = v * (1 - (1 - f) * s);
    switch (i % 6) {
        case 0: r = v, g = t, b = p; break;
        case 1: r = q, g = v, b = p; break;
        case 2: r = p, g = v, b = t; break;
        case 3: r = p, g = q, b = v; break;
        case 4: r = t, g = p, b = v; break;
        case 5: r = v, g = p, b = q; break;
    }
    return {
        r: Math.floor(r * 255),
        g: Math.floor(g * 255),
        b: Math.floor(b * 255)
    };
}

function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function getSeriesColor(index, count) {
	var saturation = 0.95; // Saturation
    var brightness = 0.8;  // Brightness
    var hue = index / count;
    
	var rgb = HSVtoRGB(hue, saturation, brightness);
	return rgbToHex(rgb.r, rgb.g, rgb.b);
}


//Graph setup
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
         enabled: true
     }
};

//Historical hashrate overrides
var historicalHashrateLineChart = {
		yAxis: {
         title: {
             text: 'kHash/s'
         }
     },
     series: [{
         name: 'Hashrate',
         data: [],
         color: '#ff3333',
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

//Balance history override configuration
var historicalBalanceLineChart = {
	yAxis: {
     title: {
         text: 'btc'
     }
 },
 series: [
 {
     name: 'Unconverted',
     data: [],
     color: '#a6bddb',
     marker: {
     	symbol: 'circle',
     	radius: 2
     }
 },
 {
     name: 'Confirmed',
     data: [],
     color: '#74a9cf',
     marker: {
     	symbol: 'circle',
     	radius: 2
     }
 },
 {
     name: 'Unsent',
     data: [],
     color: '#2b8cbe',
     marker: {
     	symbol: 'circle',
     	radius: 2
     }
 },
 {
     name: 'Sent',
     data: [],
     color: '#045a8d',
     marker: {
     	symbol: 'circle',
     	radius: 2
     }
 },
 {
     name: 'Payments',
     data: [],
     color: '#74c476',
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

var summaryChart = {
	title : {
		text : null
	},
	legend : {
		enabled : true
	},
	xAxis : {
		type : 'datetime',
		title : {
			text : null
		},
		dateTimeLabelFormats : {
			month : '%e. %b',
			year : '%b'
		}
	},
	yAxis : [ {
		title : {
			text : 'Bitcoin'
		},
		plotLines : [ {
			color : '#fd8d3c',
			width : 2,
			value : 0.01,
			label : 'Payout',
			zIndex : 5,
			dashStyle: 'dash'
		} ],
		min: 0
	}, {
		title : {
			text : 'kHash/s'
		},
		min: 0,
		opposite : true
	} ],
	plotOptions : {
		areaspline : {
			fillOpacity : 0.8,
			stacking : 'normal'
		}
	},
	series : [ {
		name : 'Sent',
		type : 'areaspline',
		yAxis : 0,
		data : [],
		color : '#6baed6',
		marker : {
			symbol : 'circle',
			radius : 2
		},
		tooltip : {
			valuePrefix : '฿',
			valueDecimals : 8
		}
	}, {
		name : 'Unconverted',
		type : 'areaspline',
		yAxis : 0,
		data : [],
		color : '#3182bd',
		marker : {
			symbol : 'circle',
			radius : 2
		},
		tooltip : {
			valuePrefix : '฿',
			valueDecimals : 8
		}
	}, {
		name : 'Confirmed',
		type : 'areaspline',
		yAxis : 0,
		data : [],
		color : '#08519c',
		marker : {
			symbol : 'circle',
			radius : 2
		},
		tooltip : {
			valuePrefix : '฿',
			valueDecimals : 8
		}
	}, {
     name: 'Payments',
     type : 'spline',
     yAxis : 0,
     data: [],
     color: '#74c476',
     marker: {
     	symbol: 'circle',
     	radius: 2
     },
		tooltip : {
			valuePrefix : '฿',
			valueDecimals : 8
		}
 }, {
		name : 'Hashrate',
		type : 'spline',
		yAxis : 1,
		data : [],
		color : '#ff0a00',
		marker : {
			symbol : 'circle',
			radius : 2
		},
		tooltip : {
			valueSuffix : 'kH/s',
			valueDecimals : 2
		}
	} ]
};

var WORKER_SERIES_BASE = {
	HASHRATE_CHART: {
		data: [],
		dashStyle: 'ShortDot',
     color: '#ff3333',
     marker: {
     	symbol: 'circle',
     	radius: 2
     }
	},
	SUMMARY: {
		type : 'spline',
		dashStyle: 'ShortDot',
		yAxis : 1,
		data : [],
		color : '#ff0a00',
		marker : {
			symbol : 'circle',
			radius : 2
		},
		tooltip : {
			valueSuffix : 'kH/s',
			valueDecimals : 2
		}
	}
};

THEMES["nighttime"].charts = {
	colors : [ "#DDDF0D", "#7798BF", "#55BF3B", "#DF5353", "#aaeeee",
			"#ff0066", "#eeaaee", "#55BF3B", "#DF5353", "#7798BF", "#aaeeee" ],
	chart : {
		backgroundColor : '#272b30',
		borderWidth : 0,
		borderRadius : 0,
		plotBackgroundColor : null,
		plotShadow : false,
		plotBorderWidth : 0
	},
	title : {
		style : {
			color : '#FFF',
			font : '16px Lucida Grande, Lucida Sans Unicode, Verdana, Arial, Helvetica, sans-serif'
		}
	},
	subtitle : {
		style : {
			color : '#DDD',
			font : '12px Lucida Grande, Lucida Sans Unicode, Verdana, Arial, Helvetica, sans-serif'
		}
	},
	xAxis : {
		gridLineWidth : 0,
		lineColor : '#999',
		tickColor : '#999',
		labels : {
			style : {
				color : '#999',
				fontWeight : 'bold'
			}
		},
		title : {
			style : {
				color : '#AAA',
				font : 'bold 12px Lucida Grande, Lucida Sans Unicode, Verdana, Arial, Helvetica, sans-serif'
			}
		}
	},
	yAxis : {
		alternateGridColor : null,
		minorTickInterval : null,
		gridLineColor : 'rgba(255, 255, 255, .1)',
		minorGridLineColor : 'rgba(255,255,255,0.07)',
		lineWidth : 0,
		tickWidth : 0,
		labels : {
			style : {
				color : '#999',
				fontWeight : 'bold'
			}
		},
		title : {
			style : {
				color : '#AAA',
				font : 'bold 12px Lucida Grande, Lucida Sans Unicode, Verdana, Arial, Helvetica, sans-serif'
			}
		}
	},
	legend : {
		itemStyle : {
			color : '#CCC'
		},
		itemHoverStyle : {
			color : '#FFF'
		},
		itemHiddenStyle : {
			color : '#333'
		}
	},
	labels : {
		style : {
			color : '#CCC'
		}
	},
	tooltip : {
		backgroundColor : {
			linearGradient : {
				x1 : 0,
				y1 : 0,
				x2 : 0,
				y2 : 1
			},
			stops : [ [ 0, 'rgba(96, 96, 96, .8)' ],
					[ 1, 'rgba(16, 16, 16, .8)' ] ]
		},
		borderWidth : 0,
		style : {
			color : '#FFF'
		}
	},

	plotOptions : {
		series : {
			nullColor : '#444444'
		},
		line : {
			dataLabels : {
				color : '#CCC'
			},
			marker : {
				lineColor : '#333'
			}
		},
		spline : {
			marker : {
				lineColor : '#333'
			}
		},
		scatter : {
			marker : {
				lineColor : '#333'
			}
		},
		candlestick : {
			lineColor : 'white'
		}
	},

	toolbar : {
		itemStyle : {
			color : '#CCC'
		}
	},

	navigation : {
		buttonOptions : {
			symbolStroke : '#DDDDDD',
			hoverSymbolStroke : '#FFFFFF',
			theme : {
				fill : {
					linearGradient : {
						x1 : 0,
						y1 : 0,
						x2 : 0,
						y2 : 1
					},
					stops : [ [ 0.4, '#606060' ], [ 0.6, '#333333' ] ]
				},
				stroke : '#000000'
			}
		}
	},

	// scroll charts
	rangeSelector : {
		buttonTheme : {
			fill : {
				linearGradient : {
					x1 : 0,
					y1 : 0,
					x2 : 0,
					y2 : 1
				},
				stops : [ [ 0.4, '#888' ], [ 0.6, '#555' ] ]
			},
			stroke : '#000000',
			style : {
				color : '#CCC',
				fontWeight : 'bold'
			},
			states : {
				hover : {
					fill : {
						linearGradient : {
							x1 : 0,
							y1 : 0,
							x2 : 0,
							y2 : 1
						},
						stops : [ [ 0.4, '#BBB' ], [ 0.6, '#888' ] ]
					},
					stroke : '#000000',
					style : {
						color : 'white'
					}
				},
				select : {
					fill : {
						linearGradient : {
							x1 : 0,
							y1 : 0,
							x2 : 0,
							y2 : 1
						},
						stops : [ [ 0.1, '#000' ], [ 0.3, '#333' ] ]
					},
					stroke : '#000000',
					style : {
						color : 'yellow'
					}
				}
			}
		},
		inputStyle : {
			backgroundColor : '#333',
			color : 'silver'
		},
		labelStyle : {
			color : 'silver'
		}
	},

	navigator : {
		handles : {
			backgroundColor : '#666',
			borderColor : '#AAA'
		},
		outlineColor : '#CCC',
		maskFill : 'rgba(16, 16, 16, 0.5)',
		series : {
			color : '#7798BF',
			lineColor : '#A6C7ED'
		}
	},

	scrollbar : {
		barBackgroundColor : {
			linearGradient : {
				x1 : 0,
				y1 : 0,
				x2 : 0,
				y2 : 1
			},
			stops : [ [ 0.4, '#888' ], [ 0.6, '#555' ] ]
		},
		barBorderColor : '#CCC',
		buttonArrowColor : '#CCC',
		buttonBackgroundColor : {
			linearGradient : {
				x1 : 0,
				y1 : 0,
				x2 : 0,
				y2 : 1
			},
			stops : [ [ 0.4, '#888' ], [ 0.6, '#555' ] ]
		},
		buttonBorderColor : '#CCC',
		rifleColor : '#FFF',
		trackBackgroundColor : {
			linearGradient : {
				x1 : 0,
				y1 : 0,
				x2 : 0,
				y2 : 1
			},
			stops : [ [ 0, '#000' ], [ 1, '#333' ] ]
		},
		trackBorderColor : '#666'
	},

	// special colors for some of the demo examples
	legendBackgroundColor : 'rgba(48, 48, 48, 0.8)',
	legendBackgroundColorSolid : 'rgb(70, 70, 70)',
	dataLabelsColor : '#444',
	textColor : '#E0E0E0',
	maskColor : 'rgba(255,255,255,0.3)'
};