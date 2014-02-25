$(document).ready(function() {
	// Create hashrate setting javascript elements
	$("#hashrateEnabledChk").bootstrapSwitch();
	$("#averageMinutes").slider().on('slide', hashrateMinutesListener);
	$("#averageDays").slider().on('slide', hashrateDaysListener);
	$("#percentThreshold").slider().on('slide', hashratePercentListener);

	// Attach hashrate setting javascript element listeners
	$("#hashrateEnabledChk").on('switchChange', function (e, data) {
		setHashrateSettingsVisible(data.value);
		("#hashrateEnabled").val(data.value.toString());
	});

	// Set hashrate settings visible
	setHashrateSettingsVisible($("#hashrateEnabled").is(':checked'));
	
	// Create payment setting javascript elements
	$("#paymentEnabledChk").bootstrapSwitch();
	
	// Attach hashrate setting javascript element listeners
	$("#paymentEnabledChk").on('switchChange', function (e, data) {
		setHashrateSettingsVisible(data.value);
		("#paymentEnabled").val(data.value.toString());
	});
});

var hashrateMinutesListener = function(ev) {
	$("#hashrateMinutesValue").html(ev.value);
};

var hashrateDaysListener = function(ev) {
	$("#averageDaysValue").html(ev.value);
};

var hashratePercentListener = function(ev) {
	$("#percentThresholdValue").html(ev.value);
};

function setHashrateSettingsVisible(visible) {
	if (visible) {
		$("#hashrateSettings").show();
	} else {
		$("#hashrateSettings").hide();
	}
}