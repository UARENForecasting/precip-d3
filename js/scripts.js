// scripts.js is the entry point for the page.
// Control flows from one callback function to the next.
// First, MEI data is loaded via d3.csv.
// The callback function for the MEI load will call the function to
// request the precip data.
// The precip data callback function will call the function to make
// the chart.

// data files
var meiURL = 'data/mei_v1_v2.csv'; // created by meiv2.py. obtained from mei v1 and v2 data at https://psl.noaa.gov/enso/mei/index.html
var oniURL = 'data/oni.csv'; // obtained from http://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt and processed using wholmgren's oni_to_csv jupyter notebook
var pdoURL = 'data/pdo.csv'; // obtained from https://www.ncdc.noaa.gov/teleconnections/pdo/data.csv

// global variables
// maybe bad practice, but global scope makes life easier while developing
var acis_data;
var acis_lat;
var acis_lon;
var acis_name;

var dataParsed;
var dataNested;
var dataNestedByDay;
var dataStatsByDay;

var meiraw;
var oniraw;
var pdoraw;
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
d3.csv(meiURL, mei_parser).then(mei_callback).catch(failureCallback);
d3.csv(oniURL, oni_parser).then(oni_callback).catch(failureCallback);
d3.csv(pdoURL, pdo_parser).then(pdo_callback).catch(failureCallback);


function failureCallback(error) {
    console.error("Error getting data: " + error);
}


// everything from here down is a function that is called by something above.

// a function to parse the date strings in the csv file
var dateparser = d3.timeParse("%Y%m%d")
var dateparser_acis = d3.timeParse("%Y-%m-%d")
var dateformatter_acis = d3.timeFormat("%Y-%m-%d")


// a function to parse the precip data from a csv file
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

var acis_data;


// a function to parse precip data from acis, then call the function for
// updating the chart
function precip_parser_acis(text) {
    console.log('precip_parser_acis');
    console.log(text);
    if (typeof(text.error) !== 'undefined') {
        console.log('invalid station, malformed request, or no data available');
        return;
    }

    var lat = text.meta.ll[1]
    var lon = text.meta.ll[0]
    var name = text.meta.name

    var data = text.data.map(function(row) {
        //console.log(row);

        var d = {date: dateparser_acis(row[0]),
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
        total += day.precip;
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


// bbox does not currently work.
function get_acis_data(sid, state, bbox) {
    console.log("get_acis_data with args ", sid, state);

    var params = {
            sdate: "1950-10-01",
            //sdate: "2015-10-01",
            edate: dateformatter_acis(new Date()),
            elems: [{"name":"pcpn","interval":"dly"}],
            output: "json"
        };

    var parser;

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

    d3.json(url+"?params="+params_string).then(parser)
      .catch(function(error) {
          console.log("error parsing precip data with parser", parser, error)
      });
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


function mei_callback(rows) {
    console.log("mei_callback");
    // console.log('retrieved mei data: ', rows);

    meiraw = rows;

    var meiIndex = d3.group(rows, d => d.YEAR);

    ensoIndexMapping['MEI'] = meiIndex;
    chart.ensoIndex('MEI');

    parse_url_and_get_data();
}


function oni_parser(d) {
    //console.log(d);
    d.year = +d.Year
    return d;
}


function oni_callback(rows) {
    // console.log('retrieved oni data: ', rows);

    oniraw = rows;

    var oniIndex = d3.group(rows, d => d.Year)

    ensoIndexMapping['ONI'] = oniIndex;
}

function pdo_parser(d) {
    //console.log(d);

    d.Year = d.Date.slice(0, 4);
    d.year = +d.Year;
    d.month = String(+d.Date.slice(-2));

    return d;
}

function pdo_callback(rows) {
    // console.log(error);
    // console.log('retrieved pdo data: ', rows);

    pdoraw = rows;

    var pdoIndex = d3.group(pdoraw, d => d.Year);

    // create new map with identical structure to MEI, ONI map
    var pdoIndexObject = new Map();
    pdoIndex.forEach(function(yr_d, year) {
        var d = {};
        yr_d.forEach(function(value, key) {
            d[value['month']] = value['Value'] });
            pdoIndexObject.set(year, [d])
    })

    ensoIndexMapping['PDO'] = pdoIndexObject;
}

function parse_url_and_get_data() {
    console.log("parse_url_and_get_data");
    var id = getUrlParameter('id');
    var sid = getUrlParameter('sid');
    var state = getUrlParameter('state');
    var bbox = getUrlParameter('bbox');

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
    console.log("initializePlots");

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
