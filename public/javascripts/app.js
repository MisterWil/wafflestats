// Hashrate Storage Array [timestamp, hashrate]
var hashrate = [];

// Confirmed and Unconverted Bitcoins Storage Array [timestamp, bitcoin value]
var confirmedBal = [];
var unconvertedBal = [];

// Sent Bitcoins Storage Array [timestamp, bitcoin value]
var sentBal = [];

// Meters
var hashRateMeter = null;
var hashRateGraph = null;
var balancesGraph = null;

// Last data update
var lastUpdate = null;

// Bitcoin address
var address = null;

$(document).ready(function() {
	
	address = $.getUrlVar('address');
	
	if (address === undefined) {
		$("#stats").hide();
	} else {
		$("#bitcoinAddressForm").hide();
		// Create hashrate Meter
		hashRateMeter = $.jqplot('hashRateMeter', [ [ 1 ] ], {
			title : 'Current Hashrate',
			seriesDefaults : {
				renderer : $.jqplot.MeterGaugeRenderer,
				rendererOptions : {
					label : 'kH/s'
				}
			}
		});
		
		// Create hashrate graph
		hashRateGraph = $.jqplot('hashRateGraph', [ [ null ] ], {
			title : 'Hashrate History',
			series : [ {
				label : 'Hashrate',
				color : 'rgba(255, 61, 61, 1)'
			} ],
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
					tickOptions : {
						formatString : '%.2f kH/s'
					}
				}
			},
			highlighter : {
				show : true,
				sizeAdjust : 7.5
			},
			cursor : {
				show : false
			}
		});
		
		// create balances graph
		balancesGraph = $.jqplot('balancesGraph', [ [ null ], [ null ] ], {
			title : 'Balance History',
			series : [ {
				label : 'Confirmed',
				color : 'rgba(61, 255, 61, 1)'
			}, {
				label : 'Unconverted',
				color : 'rgba(255, 255, 61, 1)'
			} ],
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
					tickOptions : {
						formatString : '฿ %.6f'
					}
				},
			},
			legend : {
				show : true,
				placement : 'outside'
			},
			highlighter : {
				show : true,
				sizeAdjust : 7.5
			},
			cursor : {
				show : false
			}
		});
		
		startUpdate();
		
		var interval = self.setInterval(function() {
			startUpdate();
		}, 30000);
		
	}
});

function startUpdate() {
	if (address != undefined) {
		var url = '/temp-api/' + address;
		$.getJSON(url, function(data) {
			
			lastUpdate = new Date().getTime();
			
			var sentBalance = parseFloat(data.balances.sent);
			var confirmedBalance = parseFloat(data.balances.confirmed);
			var unconvertedBalance = parseFloat(data.balances.unconverted);

			sentBal.push([ lastUpdate, sentBalance ]);
			confirmedBal.push([ lastUpdate, confirmedBalance ]);
			unconvertedBal.push([ lastUpdate, unconvertedBalance ]);

			var rawHR = parseInt(data.hash_rate);
			var khashrate = rawHR / 1000.0;
			hashrate.push([ lastUpdate, khashrate ]);

			hashRateMeter.resetAxesScale();
			hashRateMeter.replot({
				data : [ [ khashrate ] ]
			});

			hashRateGraph.resetAxesScale();
			hashRateGraph.replot({
				data : [ hashrate ]
			});

			$('#hashRate').html(sprintf("%.2f kH/s", khashrate));

			balancesGraph.resetAxesScale();
			balancesGraph.replot({
				data : [ confirmedBal, unconvertedBal ]
			});

			$('#sent').html(sprintf("฿ %.6f", sentBalance));
			$('#confirmed').html(sprintf("฿ %.6f", confirmedBalance));
			$('#unconverted').html(sprintf("฿ %.6f", unconvertedBalance));
			
			$('#lastUpdate').html(new Date(lastUpdate).toLocaleString());

		});
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