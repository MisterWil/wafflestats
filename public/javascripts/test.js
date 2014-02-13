$(window).resize(function() {
    $('#historalHashrate').highcharts().reflow();
    $('#historicalBalances').highcharts().reflow();
});

$(document).ready(function () {
	
	$.pnotify.defaults.history = false;
	$.pnotify.defaults.styling = "bootstrap3";
	
	/*var notice = $.pnotify({
	    title: 'WAFFLEStats Updated',
	    text: 'Refresh this page to start using the latest version now!',
	    type: 'info',
	    icon: 'fa fa-arrow-up',
	    sticker: false,
	    hide: false,
	    closer_hover: false
	});*/
    
    $('#historalHashrate').highcharts({
    	chart: {
            type: 'spline'
        },
        title: {
            text: null
        },
        xAxis: {
        	type: 'datetime',
            maxZoom: 14 * 24 * 3600000, // fourteen days
            title: {
                text: null
            },
	        dateTimeLabelFormats: { // don't display the dummy year
	            month: '%e. %b',
	            year: '%b'
	        }
        },
        yAxis: {
            title: {
                text: 'kHash/s'
            },
            plotLines: [{
                value: 0,
                width: 1,
                color: '#808080'
            }]
        },
        legend: {
            enabled: false
        },
        tooltip: {
            valueSuffix: 'kH/s'
        },
        series: [{
            name: 'Hashrate',
            data: [
                   [1000000000, 1500],
                   [2000000000, 1200],
                   [3000000000, 1300],
                   [4000000000, 1700],
                   [5000000000, 900],]
        }]
    });
    
    $('#historicalBalances').highcharts({
        title: {
            text: null
        },
        xAxis: {
            categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        },
        yAxis: {
            title: {
                text: 'Temperature (°C)'
            },
            plotLines: [{
                value: 0,
                width: 1,
                color: '#808080'
            }]
        },
        tooltip: {
            valueSuffix: '°C'
        },
        series: [{
            name: 'Tokyo',
            data: [7.0, 6.9, 9.5, 14.5, 18.2, 21.5, 25.2, 26.5, 23.3, 18.3, 13.9, 9.6]
        }, {
            name: 'New York',
            data: [-0.2, 0.8, 5.7, 11.3, 17.0, 22.0, 24.8, 24.1, 20.1, 14.1, 8.6, 2.5]
        }, {
            name: 'Berlin',
            data: [-0.9, 0.6, 3.5, 8.4, 13.5, 17.0, 18.6, 17.9, 14.3, 9.0, 3.9, 1.0]
        }, {
            name: 'London',
            data: [3.9, 4.2, 5.7, 8.5, 11.9, 15.2, 17.0, 16.6, 14.2, 10.3, 6.6, 4.8]
        }]
    });
});