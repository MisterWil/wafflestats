var hashrateFormatString = "%.2f kH/s";
var dpsFormatString = "%.3f/s";
var bitcoinFormatString = '<i class="fa fa-btc">&nbsp;%.8f';
var bytesFormatString = "%f bytes";
var megabytesFormatString = "%.3f mb";
var timeFormatString = "%s ago";

$(document).ready(function() {
	address = $.url().param('address');
	
	/**
	 * More backwards compatability... will forward anyone who has an address set on the index page to the new stats page.
	 */
	if (address !== undefined) {
		return window.location.assign('/stats?address=' + address);
	}
	
	getMetrics();
});

function getMetrics() {
    $.getJSON("/metrics", function(metrics) {
        if (metrics !== undefined) {
            setMetricsData(metrics);
        }
    });
};

function setMetricsData(metrics) {
    $("#total_addresses").html(metrics.uniqueAddresses);
    $("#databaseSize").html(sprintf(megabytesFormatString, metrics.stats.size/1024.0/1024.0));
    $("#dbObjectSize").html(sprintf(bytesFormatString, metrics.stats.avgObjSize));
    $("#indexSize").html(sprintf(megabytesFormatString, metrics.stats.totalIndexSize/1024.0/1024.0));
    $("#lifetime_totalDatapoints").html(metrics.lifetime.totalDatapoints);
    $("#last24_totalDatapoints").html(metrics.last24.totalDatapoints);
    $("#lifetime_averageHashrate").html(sprintf(hashrateFormatString, metrics.lifetime.averageHashrate/1000));
    $("#last24_averageHashrate").html(sprintf(hashrateFormatString,metrics.last24.averageHashrate/1000));
    $("#lifetime_maximumHashrate").html(sprintf(hashrateFormatString,metrics.lifetime.maximumHashrate/1000));
    $("#last24_maximumHashrate").html(sprintf(hashrateFormatString,metrics.last24.maximumHashrate/1000));
    $("#lifetime_averageSent").html(sprintf(bitcoinFormatString, metrics.lifetime.averageSent));
    $("#last24_averageSent").html(sprintf(bitcoinFormatString, metrics.last24.averageSent));
    $("#lifetime_maximumSent").html(sprintf(bitcoinFormatString, metrics.lifetime.maximumSent));
    $("#last24_maximumSent").html(sprintf(bitcoinFormatString, metrics.last24.maximumSent));
    
    var timeSinceOldestMillis = new Date().getTime() - new Date(metrics.lifetime.oldestDatapoint).getTime();
    $("#firstDatapoint").html(sprintf(timeFormatString, secondsToString(timeSinceOldestMillis/1000)));
    
    var lifetimeMillis = new Date(metrics.lifetime.newestDatapoint).getTime() - new Date(metrics.lifetime.oldestDatapoint).getTime();
    var lifetimeSeconds = lifetimeMillis / 1000;
    var lifetimeDPS = lifetimeSeconds != 0 ? metrics.lifetime.totalDatapoints / lifetimeSeconds : 0;
    
    var last24Millis = new Date(metrics.last24.newestDatapoint).getTime() - new Date(metrics.last24.oldestDatapoint).getTime();
    var last24Seconds = last24Millis / 1000;
    var last24DPS = last24Seconds != 0 ? metrics.last24.totalDatapoints / last24Seconds : 0;
    
    
    $("#lifetime_dps").html(sprintf(dpsFormatString, lifetimeDPS));
    $("#last24_dps").html(sprintf(dpsFormatString, last24DPS));
}

function secondsToString(seconds) {
    var numdays = Math.floor((seconds % 31536000) / 86400);
    var numhours = Math.floor(((seconds % 31536000) % 86400) / 3600);
    var numminutes = Math.floor((((seconds % 31536000) % 86400) % 3600) / 60);
    var numseconds = (((seconds % 31536000) % 86400) % 3600) % 60;
    return sprintf('%.0f days %.0f hours %.0f minutes %.0f seconds', numdays, numhours, numminutes, numseconds);
}