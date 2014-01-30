var sentBal = [];
var confirmedBal = [];
var unconvertedBal = [];
var hashrate = [];
var plot1 = null;

$(window).on("resize", function() {
	plot1.resetAxesScale();
	plot1.replot();
});

$(document).ready(function() {
	startUpdate();

	var minDate = new Date();
	minDate.setDate(minDate.getDate() - 1);
		
	// create the chart
	plot1 = $.jqplot('userGraph', [ [ null ], [ null ], [ null ], [ null ] ], {
		title : 'User Data',
		series : [ {
			label : 'Sent',
			color: 'rgba(61, 61, 255, 1)'
		}, {
			label : 'Confirmed Balance',
			color: 'rgba(61, 255, 61, 1)'
		}, {
			label : 'Unconverted Balance',
			color: 'rgba(255, 255, 61, 1)'
		}, {
			label : 'Hashrate',
			yaxis : 'y2axis',
			color: 'rgba(255, 61, 61, 1)'
		} ],
		// Show the legend and put it outside the grid, but inside the
		// plot container, shrinking the grid to accomodate the legend.
		// A value of "outside" would not shrink the grid and allow
		// the legend to overflow the container.
		legend : {
			show : true,
			placement : 'outsideGrid'
		},
		axes : {
			xaxis : {
				renderer : $.jqplot.DateAxisRenderer,
				tickRenderer: $.jqplot.CanvasAxisTickRenderer,
				tickOptions : {
					formatString : '%b %#d %H:%M',
					angle: -45
				},
				tickInterval : '30 second'
			},
			yaxis : {
				tickOptions : {
					formatString : '฿ %.6f'
				}
			},
			y2axis : {
				labelRenderer : $.jqplot.CanvasAxisLabelRenderer,
				label : 'Hashrate',
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

	 var interval = self.setInterval(function() { startUpdate(); }, 30000);
});

function startUpdate() {
	var address = $.getUrlVar('address');
	
	if (address === undefined) {
		$('#content').html('Please provide an address via ?address=<address>');
	} else {
		var url = '/temp-api/' + address;
		$.getJSON(url, function(data) {
			var date = new Date().getTime();
			sentBal.push([date, parseFloat(data.balances.sent)]);
			confirmedBal.push([date, parseFloat(data.balances.confirmed)]);
			unconvertedBal.push([date, parseFloat(data.balances.unconverted)]);
			
			var rawHR = parseInt(data.hash_rate);
			var khashrate = rawHR / 1000.0;
			hashrate.push([date, khashrate]);

			var series = [sentBal, confirmedBal, unconvertedBal, hashrate];
			
			plot1.resetAxesScale();
			plot1.replot({data:series});
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