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
		unsent : [],
		confirmed : [],
		unconverted : [],
		payments: []
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
		historicalBalances : null,
		summaryChart : null
};

var SHOWING = {
		BALANCES : {
			confirmed: true,
			unconverted: true,
			unsent: true,
			sent: false,
			payments: true
		}
};

var TIME_SCALES = {
	HASHRATE : {
		resolution: '30min',
		range: '3day'
	},
	BALANCES : {
		resolution: '30min',
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
var titleFormatString = "%.2f kH/s - WAFFLEStats";

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
            enabled: true
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

// Balance history override configuration
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
		name : 'Confirmed',
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
		name : 'Unconverted',
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
	$('.chartsTab').click(function() {
		setTimeout(function() {
			reflowGraphs();
		}, 200);
	});

	$('.theme-link').click(function() {
		currentTheme = $(this).attr('data-theme');
		
		var themeurl = THEMES[currentTheme].css;
		$('#theme').attr('href', themeurl);

		initGraphs();
		updateBalancesVisibility();
		replotHistoricalGraph();
		replotBalanceGraph();
		replotSummaryChart();
	});
	
	$('#resolution_hashrate button').click(function (e) {
		if (LOADING.hashRate === STATES.READY) {
			var value = $(this).val();
			
			if (value !== undefined) {
				value = value.trim();
				TIME_SCALES.HASHRATE.resolution = value;
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
				updateBalancesHistory();
			}
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
	if (SHOWING.BALANCES.unsent) {
		$('#visibility_balances label[value="unsent"]').button('toggle');
	}
	if (SHOWING.BALANCES.sent) {
		$('#visibility_balances label[value="sent"]').button('toggle');
	}
	if (SHOWING.BALANCES.payments) {
		$('#visibility_balances label[value="payments"]').button('toggle');
	}
	
	$('#visibility_balances label').click(function (e) {
		var name = $(this).find('input').val();
		
		SHOWING.BALANCES[name] = !SHOWING.BALANCES[name];
		
		updateBalancesVisibility();
	});
}

function initGraphs() {
	if (GRAPHS.historicalHashrate) {
		GRAPHS.historicalHashrate.destroy();
	}
	
	if (GRAPHS.historicalBalances) {
		GRAPHS.historicalBalances.destroy();
	}
	
	if (GRAPHS.summaryChart) {
		GRAPHS.summaryChart.destroy();
	}

	// Create hashrate graph
	$('#historalHashrate').highcharts($.extend(true, {}, THEMES[currentTheme].charts, lineChartDefaults, historicalHashrateLineChart));
	GRAPHS.historicalHashrate = $('#historalHashrate').highcharts();
	
	// Create balances graph
	$('#historicalBalances').highcharts($.extend(true, {}, THEMES[currentTheme].charts, lineChartDefaults, historicalBalanceLineChart));
	GRAPHS.historicalBalances = $('#historicalBalances').highcharts();
	
	// Create summary graph
	$('#summaryChart').highcharts($.extend(true, {}, THEMES[currentTheme].charts, summaryChart));
	GRAPHS.summaryChart = $('#summaryChart').highcharts();
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

	HISTORY_INTERVALS.hashRate = SCALE_MILLIS['val_'
			+ TIME_SCALES.HASHRATE.resolution];

	if (LOADING.hashRate === STATES.READY) {
		LOADING.hashRate = STATES.LOADING;

		lastHashrateHistoryUpdate = new Date();

		disableTimeScaleButtons('hashrate');

		showHashRateLoading();
		showSummaryLoading();

		var url = sprintf(historicalHashRateURL, address, TIME_SCALES.HASHRATE.resolution, TIME_SCALES.HASHRATE.range);
		
		$.ajax({
			url : url,
			dataType : 'json',
			success : function(history) {
				if (history !== undefined && history.length > 0) {
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
		showSummaryLoading();
		
		var url = sprintf(historicalBalancesURL, address, TIME_SCALES.BALANCES.resolution, TIME_SCALES.BALANCES.range);
		
		$.ajax({
			url : url,
			dataType : 'json',
			success : function(history) {
				if (history !== undefined && history.length > 0) {
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

function updateBalancesVisibility() {
	GRAPHS.historicalBalances.series[0].setVisible(SHOWING.BALANCES.unconverted);
	GRAPHS.historicalBalances.series[1].setVisible(SHOWING.BALANCES.confirmed);
	GRAPHS.historicalBalances.series[2].setVisible(SHOWING.BALANCES.unsent);
	GRAPHS.historicalBalances.series[3].setVisible(SHOWING.BALANCES.sent);
	//GRAPHS.historicalBalances.series[4].setVisible(SHOWING.BALANCES.payments);
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
		HISTORICAL_DATA.unsent.push([ date.getTime(), data.balances.confirmed + data.balances.unconverted ]);
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
	HISTORICAL_DATA.unsent = [];
	HISTORICAL_DATA.confirmed = [];
	HISTORICAL_DATA.unconverted = [];
	HISTORICAL_DATA.payments = [];
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
		replotSummaryChart();
		
		hideHashRateLoading();
		hideSummaryLoading();
		enableTimeScaleButtons('hashrate');
	}
	
	if (LOADING.balances === STATES.LOADED) {
		LOADING.balances = STATES.READY;
		
		replotBalanceGraph();
		replotSummaryChart();
		
		hideBalancesLoading();
		hideSummaryLoading();
		enableTimeScaleButtons('balances');
	}
}

function replotHistoricalGraph() {
	GRAPHS.historicalHashrate.series[0].setData(HISTORICAL_DATA.hashRate, false);
	GRAPHS.historicalHashrate.redraw();
}

function replotBalanceGraph() {
	GRAPHS.historicalBalances.series[0].setData(HISTORICAL_DATA.unconverted, false);
	GRAPHS.historicalBalances.series[1].setData(HISTORICAL_DATA.confirmed, false);
	GRAPHS.historicalBalances.series[2].setData(HISTORICAL_DATA.unsent, false);
	GRAPHS.historicalBalances.series[3].setData(HISTORICAL_DATA.sent, false);
	//GRAPHS.historicalBalances.series[4].setData(HISTORICAL_DATA.payments, false);
	GRAPHS.historicalBalances.redraw();
}

function replotSummaryChart() {
	GRAPHS.summaryChart.series[0].setData(HISTORICAL_DATA.sent, false);
	GRAPHS.summaryChart.series[1].setData(HISTORICAL_DATA.confirmed, false);
	GRAPHS.summaryChart.series[2].setData(HISTORICAL_DATA.unconverted, false);
	
	GRAPHS.summaryChart.series[3].setData(HISTORICAL_DATA.hashRate, false);
	GRAPHS.summaryChart.redraw();
}

function reflowGraphs() {
	GRAPHS.historicalHashrate.reflow();
	GRAPHS.historicalBalances.reflow();
	GRAPHS.summaryChart.reflow();
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
	
	setValue(".hashrateValue", sprintf(hashrateDecimalFormatString, CURRENT_DATA.hashRate));
	
	document.title = sprintf(titleFormatString, CURRENT_DATA.hashRate);
	
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