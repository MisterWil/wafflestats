/**
 * More backwards compatability... will forward anyone who has an address set on the index page to the new stats page.
 */

$(document).ready(function() {
	address = $.url().param('address');
	
	if (address !== undefined) {
		window.location.assign('/stats?address=' + address);
	}
});