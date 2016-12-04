// scripts.js is the entry point for the page.
// Control flows from one callback function to the next.
// First, MEI data is loaded via d3.csv.
// The callback function for the MEI load will call the function to
// request the precip data.
// The precip data callback function will call the function to make
// the chart.

// data files
var meiURL = 'data/mei.csv'; // http://www.esrl.noaa.gov/psd/enso/mei/table.html
var oniURL = 'data/oni.csv'; // obtained from https://data.hdx.rwlabs.org/dataset/monthly-oceanic-nino-index-oni/resource/ba1a3d4e-6067-4b72-a2e1-9a9b5c622080

// global variables
// maybe bad practice, but global scope makes life easier while developing
var dataParsed;
var dataNested;
var dataNestedByDay;
var dataStatsByDay;

var ensoIndexData;
var oniIndex;
var meiIndex;
var ensoIndexMapping = {};

// chart defaults
var dataDiv = "#data";

var aspectRatio = 16.0/7.0;



// make an empty plot
initializePlots();

// get the data
// the function returns immediately but tells the browser
// to execute precip_callback when the
// server returns the data to the browser
// signature: d3.csv(url, accessor, callback)
//d3.csv(dataURL, precip_parser, precip_callback);

// mei_callback has the call to precip_callback
// need to do it in order so the mei data is available first
d3.csv(meiURL, mei_parser, mei_callback);
d3.csv(oniURL, oni_parser, oni_callback);



// everything from here down is a function that is called by something above.

// a function to parse the date strings in the csv file
var dateparser = d3.time.format("%Y%m%d")
var dateparser_acis = d3.time.format("%Y-%m-%d")


// a function to parse the csv file
// this function is executed when the data is returned from the server
function precip_parser(d) {
    //console.log(d);

    // convert strings into numbers and date objects
    d.precip = +d.PRCP/254;
    d.date = dateparser.parse(d.DATE);

    // calculate waterYear and waterDay attributes
    var year = d.date.getFullYear();
    d.waterYear = d.date.getMonth() > 8 ? year + 1 : year;
    var waterYearStart = new Date(d.waterYear-1, 9, 1);
    d.waterDay = Math.round((d.date - waterYearStart) / 86400000);

    // would be best to replace with a more intelligent determination
    // of if the year has a complete data set.
    if (d.waterYear > 1950) {
        return d;
    }
}

var acis_data

function precip_parser_acis(text) {
    //console.log('precip_parser_acis');
    //console.log(text);
    if (typeof(text.error) !== 'undefined') {
        console.log('invalid station, malformed request, or no data available');
        return;
    }

    var lat = text.meta.ll[1]
    var lon = text.meta.ll[0]
    var name = text.meta.name

    var data = text.data.map(function(row) {
        //console.log(row);

        var d = {date: dateparser_acis.parse(row[0]),
                 precip: +row[1]};

        // acis returns "T" for trace, which is turned into NaN by +.
        // this turns NaNs into 0s.
        d.precip = isNaN(d.precip) ? 0 : d.precip;

        // calculate waterYear and waterDay attributes
        var year = d.date.getFullYear();
        d.waterYear = d.date.getMonth() > 8 ? year + 1 : year;
        var waterYearStart = new Date(d.waterYear-1, 9, 1);
        d.waterDay = Math.round((d.date - waterYearStart) / 86400000);

        return d;
    });

    console.log(data);

    accumulate_precip(data);

    acis_data = data;
    acis_name = name;
    acis_lat = lat;
    acis_lon = lon;

    precip_callback_acis(data);
}


function precip_parser_acis_grid(text) {
    //console.log('precip_parser_acis');
    //console.log(text);
    if (typeof(text.error) !== 'undefined') {
        console.log('invalid station, malformed request, or no data available');
        return;
    }

    //var lat = text.meta.ll[1]
    //var lon = text.meta.ll[0]
    //var name = text.meta.name

    var data = text.data.map(function(row) {
        //console.log(row);

        var d = {date: dateparser_acis.parse(row[0]),
                 precip: +d3.values(row[1])[0]};

        // acis returns "T" for trace, which is turned into NaN by +.
        // this turns NaNs into 0s.
        d.precip = isNaN(d.precip) ? 0 : d.precip;

        // calculate waterYear and waterDay attributes
        var year = d.date.getFullYear();
        d.waterYear = d.date.getMonth() > 8 ? year + 1 : year;
        var waterYearStart = new Date(d.waterYear-1, 9, 1);
        d.waterDay = Math.round((d.date - waterYearStart) / 86400000);

        return d;
    });

    console.log(data);

    accumulate_precip(data);

    acis_data = data;
    acis_state = getUrlParameter('state');
    acis_state = (typeof(acis_state) === 'undefined') ? '' : acis_state.toUpperCase();
    acis_bbox = getUrlParameter('bbox');
    acis_bbox = (typeof(acis_bbox) === 'undefined') ? '' : acis_bbox
    acis_name = acis_bbox + acis_state + ' Average';

    precip_callback_acis(data);
}


// apply this function to data for each year
// modifies array in place
function accumulate_precip(d) {
    var total = 0;
    for (var i = 0; i < d.length; i++) {
        var day = d[i];
        total+= day.precip;
        day.cumulativePrecip = total;
    }
}


function cumulativePrecipAccessor (d) { return d.cumulativePrecip };
function dailyPrecipAccessor (d) { return d.precip };

// apply this function to data for each day
// returns a new associative array
function cumulativePrecipMean(dayOfDataByDay) {
    out = {};
    out.cumulativePrecip = d3.mean(dayOfDataByDay, cumulativePrecipAccessor);
    out.precip = d3.median(dayOfDataByDay, dailyPrecipAccessor);
    out.waterDay = dayOfDataByDay[0].waterDay;
    out.date = dayOfDataByDay[0].date;

    return out;
}

function cumulativePrecipMedian(dayOfDataByDay) {
    accessor = function (d) { return d.cumulativePrecip };

    out = {};
    out.cumulativePrecip = d3.median(dayOfDataByDay, cumulativePrecipAccessor);
    out.precip = d3.median(dayOfDataByDay, dailyPrecipAccessor);
    out.waterDay = dayOfDataByDay[0].waterDay;
    out.date = dayOfDataByDay[0].date;

    return out;
}



// a function to nest the data and add it to the plot.
// this function is executed after the data is returned from the server and parsed
function precip_callback(error, rows) {
    console.log(error);
    console.log('retrieved precip data: ', rows);
    dataParsed = rows;
    dataNested = d3.nest().key(function(d) { return d.waterYear; })
                          .entries(dataParsed);
    dataNested.forEach(function (d) { accumulate_precip(d.values) });

    dataNestedByDay = d3.nest().key(function(d) { return d.waterDay; })
                          .map(dataParsed, d3.map);

    dataStatsByDay = [];
    dataStatsByDay.push({"key":"mean","values":dataNestedByDay.values().map(cumulativePrecipMean)});
    dataStatsByDay.push({"key":"median","values":dataNestedByDay.values().map(cumulativePrecipMedian)});

    // add the data to the plot
    d3.selectAll("#chart").call(chart, dataNested, true)
    d3.selectAll("#chart").call(chart, dataStatsByDay, true)

    get_acis_data()
};


function precip_callback_acis(rows) {
    console.log('retrieved precip data: ', rows);
    dataParsed = rows;
    dataNested = d3.nest().key(function(d) { return d.waterYear; })
                          .entries(dataParsed);
    dataNested.forEach(function (d) { accumulate_precip(d.values) });

    dataNestedByDay = d3.nest().key(function(d) { return d.waterDay; })
                          .map(dataParsed, d3.map);

    // add the data to the plot
    d3.selectAll("#chart").call(chart, dataNested, true)
    chart.title(acis_name + " Cumulative Precipitation");
//          .monsoonSeason();

    calc_stats();
}


var sids = {
    'tucson': "USW00023160",
    'phoenix': "USW00023183",
    'flagstaff': "USW00003103",
    'yuma': "USW00023195",
    'portland': "USW00024229",
    'seattle': "USW00024233",
    'los angeles': "USW00023174",
    'denver': "USW00003017"
    }


function get_acis_data(sid, state, bbox) {
    // bbox does not currently work.

    var params = {
            sdate: "1950-10-01",
            //sdate: "2015-10-01",
            edate: dateparser_acis(new Date()),
            elems: [{"name":"pcpn","interval":"dly"}],
            output: "json"
        };

    if (typeof(state) === 'undefined' && typeof(bbox) === 'undefined') {
        var sid = (typeof(sid) === "undefined") ? sids['tucson'] : sid;
        var url = "https://data.rcc-acis.org/StnData";
        params['sid'] = sid;
        parser = precip_parser_acis
    } else if (typeof(bbox) === 'undefined'){
        var url = "https://data.rcc-acis.org/GridData";
        params['state'] = state;
        params['grid'] = 1;
        //params.elems['reduce'] = 'mean';
        params.elems[0]['area_reduce'] = 'state_mean';
        //params.elems[0]['smry_only'] = 1;
        parser = precip_parser_acis_grid
    } else {
        var url = "https://data.rcc-acis.org/GridData";
        params['bbox'] = bbox;
        params['grid'] = 1;
        //params.elems[0]['reduce'] = 'mean';
        params.elems[0]['area_reduce'] = 'state_mean';
        //params.elems[0]['smry_only'] = 1;
        //params.elems[0]['smry'] = 'mean';
        parser = precip_parser_acis_grid
    }

    var params_string = JSON.stringify(params);

    console.log("getting data for: ", params_string);

    d3.xhr(url+"?params="+params_string, 'text/plain', function(err, data) {
        parser(JSON.parse(data.response)); });
}


function handle_acis_error(error) {
    console.log(error);
}


function calc_stats() {
    dataStatsByDay = [];
    dataStatsByDay.push({"key":"mean","values":dataNestedByDay.values().map(cumulativePrecipMean)});
    dataStatsByDay.push({"key":"median","values":dataNestedByDay.values().map(cumulativePrecipMedian)});
    d3.selectAll("#chart").call(chart, dataStatsByDay, true)
}


function mei_parser(d) {
    //console.log(d);

    d.year = +d.YEAR

    return d;
}

function mei_callback(error, rows) {
    console.log(error);
    console.log('retrieved mei data: ', rows);

    meiIndex = d3.nest().key(function(d) { return d.YEAR; }).map(rows);
    ensoIndexMapping['MEI'] = meiIndex;
    chart.ensoIndex('MEI');

    parse_url_and_get_data();
}


function oni_parser(d) {
    //console.log(d);

    d.year = +d.Year

    return d;
}

function oni_callback(error, rows) {
    console.log(error);
    console.log('retrieved oni data: ', rows);

    oniIndex = d3.nest().key(function(d) { return d.Year; }).map(rows);
    ensoIndexMapping['ONI'] = oniIndex;
}

function parse_url_and_get_data() {
    var id = getUrlParameter('id')
    var sid = getUrlParameter('sid')
    var state = getUrlParameter('state')
    var bbox = getUrlParameter('bbox')

    if (typeof(id) === 'undefined' &&
        typeof(sid) === 'undefined' &&
        typeof(state) === 'undefined' &&
        typeof(bbox) === 'undefined') {
        get_acis_data();
    } else {
        if (typeof(sid) === 'undefined') {
            sid = id
        }

        if (typeof(sid) === 'undefined') {

        } else {
            var savedId = sids[sid.toLowerCase()];
            sid = (typeof(savedId) === 'undefined') ? sid : savedId;
        }
        get_acis_data(sid, state, bbox);
    }
}

// a function to construct the graph elements.
function initializePlots() {

    var chartMetadata = [
         {id:"chart", title:"Cumulative Precipitation"},
         ];

    newChartDivs = d3.select(dataDiv).selectAll("div .chart")
                    .data(chartMetadata, function(d) { return d.id }).enter();
    newChartDivs.append("div")
                    .attr("class", "chart")
                    .attr("id", function(d){return d.id;})
                .append("div")
                    .attr("class", "chart tooltip");

    var containerWidth = d3.select(dataDiv).node().offsetWidth;
    var size = 1;
    var chartWidth = Math.round(containerWidth*size);
    var chartHeight = Math.round(chartWidth/aspectRatio);
    var margin = calculateMargin(chartWidth);

    chart = precipChart().width(chartWidth)
                                .height(chartHeight)
                                .margin(margin);

    charts = [chart];

    chartSelectorMapping = { "#chart": chart }

    // populate the graphs with the default data
    chartMetadata.forEach(function(thisMetadata) {
        thisMetadata.chart = chartSelectorMapping["#"+thisMetadata.id]
    });

    // draw empty graph
    d3.selectAll("#chart").call(chart, [], true)
}


function calculateMargin(chartWidth) {
    return {top: 50,
            right: Math.max(80, Math.round(chartWidth*0.15)),
            bottom: 45,
            left: Math.max(80, Math.round(chartWidth*0.15))}
}


var getUrlParameter = function getUrlParameter(sParam) {
    var sPageURL = decodeURIComponent(window.location.search.substring(1)),
        sURLVariables = sPageURL.split('&'),
        sParameterName,
        i;

    for (i = 0; i < sURLVariables.length; i++) {
        sParameterName = sURLVariables[i].split('=');

        if (sParameterName[0] === sParam) {
            return sParameterName[1] === undefined ? true : sParameterName[1];
        }
    }
};
