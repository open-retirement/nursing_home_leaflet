var readScore;
var overall_mapping;
var markerColorArr;

(function() {
  // Get provider_id from URL parameter, query for it in API
  var provider_id = window.location.search.replace(/^\?/, "");

  var query_string = "https://data.medicare.gov/resource/b27b-2uc7.json?$where=" +
                     "federal_provider_number='" + provider_id + "'";
  $.ajax({
      url: query_string,
      dataType: "json",
      success: function(response) {
        handleIdSearch(response, provider_id);
      }
  });
})()

function drawChart(scores, title) {
  // Create the data table.
  var data = new google.visualization.arrayToDataTable([
    ["Measure", "Score", { role: 'style' }],
    ["Overall", scores[0], markerColorArr[scores[0] - 1]],
    ["Inspections", scores[1], markerColorArr[scores[1] - 1]],
    ["Staffing", scores[2], markerColorArr[scores[2] - 1]],
    ["Nurses", scores[3], markerColorArr[scores[3] -1]]
  ]);

  // Set chart options
  var options = {'width':400,
                 'height':200,
                 'legend': {position: 'none'},
                 'chartArea': {
                   'width': '90%',
                   'height': '70%',
                 },
                 'vAxis': {
                   'ticks': [0,1,2,3,4,5],
                   'textStyle': {
                     'fontName': 'Helvetica',
                     'fontSize': 12
                   }
                 },
                 'hAxis': {
                   'textStyle': {
                     'fontName': 'Helvetica',
                     'fontSize': 13,
                     'bold': true
                   }
                 }
               };

  // Make smaller if mobile
  if (document.documentElement.clientWidth < 780) {
    options["width"] = 300;
    options["height"] = 150;
    options["hAxis"]["textStyle"]["fontSize"] = 10;
  }

  // Instantiate and draw our chart, passing in some options.
  var chart = new google.visualization.ColumnChart(document.getElementById('detail_chart'));
  chart.draw(data, options);
}



function getGoogleSheetData(provider_id) {
  var google_sheet_url = "https://script.google.com/macros/s/AKfycbynJsvP-1RjSpTR9W3Y_3cl-rqQm4aq7Mry_caMKde9_WmoMVw/exec";
  $.ajax({
     type: "POST",
     url: google_sheet_url,
     dataType: "json",
     data: {
       "id": provider_id
     },
     success: function(data) {
       $("#additional").append(
         "<p><b>Has Alzheimer's Unit:</b> " + data["alzheimers"] + "</p>" +
         "<p><b>Long Term Residents Who Received Antipsychotic Medication in Q4 2015:</b> " + data["pct_long_med_q4"] + "%</p>" +
         "<p><b>Short Term Residents Who Newly Received Antipsychotic Medication in Q4 2015:</b> " + data["pct_short_med_q4"] + "%</p>" +
         "<p><b>Cited for giving residents unnecessary drugs:</b> " + data["cited_f329"] + "</p>");
     },
     error: function(e) {
       console.error(e);
     }
  });
}

Handlebars.registerHelper("dateString", function(dateString) {
  var dateParts = dateString.split(/[^0-9]/);
  return dateParts[1] + "/" + dateParts[2] + "/" + dateParts[0];
});

// Handle response from Medicare API for provider id
function handleIdSearch(response, provider_id) {
  provider = response[0];

  var scores = [
    provider.overall_rating,
    provider.health_inspection_rating,
    provider.staffing_rating,
    provider.rn_staffing_rating
  ];

  scores = scores.map(function(d) { return parseInt(d); });

  // Assign description name based on overall rating
  provider.overall_description = overall_mapping[provider.overall_rating];

  var categories = [
    "overall_rating",
    "health_inspection_rating",
    "staffing_rating",
    "rn_staffing_rating"
  ];

  for (var i = 0; i < categories.length; ++i) {
    provider[categories[i]] = readScore(provider[categories[i]]);
  }

  provider.phone = punctuatePhone(provider.provider_phone_number);

  // Add processing for checkbox values (default as no)
  // First is continuing_care_retirement_community, special_focus_facility, provider_changed_ownership_in_last_12_months
  var checkboxFields = ["continuing_care_retirement_community", "special_focus_facility",
    "provider_changed_ownership_in_last_12_months"];

  checkboxFields.forEach(function(c) {
    provider[c] = provider[c] ? "Yes" : "No";
  });

  // provider.date_first_approved_to_provide_medicare_and_medicaid_services = parseDate(provider.date_first_approved_to_provide_medicare_and_medicaid_services);

  // Get template from script in page
  var template = $('#detail-template').html();
  var compiledTemplate = Handlebars.compile(template);
  var result = compiledTemplate(provider);
  $('#main').html(result);

  // Load the Visualization API and the corechart package.
  google.charts.load('current', {'packages':['corechart']});
  google.charts.setOnLoadCallback(function() {
    drawChart(scores, provider.provider_name);
  });

  getGoogleSheetData(provider.federal_provider_number);

  // Call other data after initial template is loaded
  var deficiency_string = "https://data.medicare.gov/resource/r5ix-sfxw.json?$where=" +
                          "federal_provider_number='" + provider_id + "'";
  $.ajax({
      url: deficiency_string,
      dataType: "json",
      success: function(response) {
        handleDeficiencies(response);
      }
  });

  var owner_string = "https://data.medicare.gov/resource/y2hd-n93e.json?$where=" +
                     "federal_provider_number='" + provider_id + "'";
  $.ajax({
      url: owner_string,
      dataType: "json",
      success: function(response) {
        handleOwnerInfo(response);
      }
  });
}

function handleDeficiencies(response) {
  var deficiencies = {deficiencies: response};
  var template = $('#deficiencies-template').html();
  var compiledTemplate = Handlebars.compile(template);
  var result = compiledTemplate(deficiencies);
  $('#deficiencies').html(result);
}

function handleOwnerInfo(response) {
  var owners = {owners: response};
  var template = $('#owner-template').html();
  var compiledTemplate = Handlebars.compile(template);
  var result = compiledTemplate(owners);
  $('#owner-info').html(result);
}
