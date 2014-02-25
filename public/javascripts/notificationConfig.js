$(document).ready(function() {
	// Create hashrate setting javascript elements
	$("#hashrateEnabled").bootstrapSwitch();
	$("#averageMinutes").slider().on('slide', hashrateMinutesListener);

	// Attach hashrate setting javascript element listeners
	$("#hashrateEnabled").on('switchChange', function (e, data) {
		setHashrateSettingsVisible(data.value);
	});

	// Create payment setting javascript elements
	$("#paymentEnabled").bootstrapSwitch();
	
	// Set hashrate settings visible
	setHashrateSettingsVisible($("#hashrateEnabled").is(':checked'));
});

var hashrateMinutesListener = function(ev) {
	$("#hashrateMinutesValue").html(ev.value);
};

function setHashrateSettingsVisible(visible) {
	if (visible) {
		$("#hashrateSettings").show();
	} else {
		$("#hashrateSettings").hide();
	}
}