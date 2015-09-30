
// set up variables

// data files
//var dataURL = 'data/tus_ncdc_1946_2015.csv'; // NCDC daily summary for TUS
var dataURL = 'data/precip_1950_2015.csv'; // NCDC daily summary for TUS
var ensoURL = 'data/mei.csv'; // http://www.esrl.noaa.gov/psd/enso/mei/table.html

// eventually replace with data file. this data is from JFM of
// http://www.cpc.ncep.noaa.gov/products/analysis_monitoring/ensostuff/ensoyears.shtml
//var ensoIndex = {"2011":-1.1,"2012":-0.6,"2013":-0.5,"2014":-0.6,"2015":0.4}

var dataParsed; // global scope makes life easier while developing
var dataNested;
var dataNestedByDay;
var dataStatsByDay;
var ensoIndex;

// chart defaults
var dataDiv = "#data";
var scaleHalf = 0.44;
var scaleFull = 0.86;
var halfFullThreshold = 960;

var aspectRatio = 16.0/8.0;


// jquery document ready
// all explicit flow control goes in here
$(function() {
    
    // make an empty plot
    initializePlots();

    // get the data
    // the function returns immediately but tells the browser
    // to execute precip_callback when the
    // server returns the data to the browser
    // signature: d3.csv(url, accessor, callback)
    //d3.csv(dataURL, precip_parser, precip_callback);
    
    d3.csv(ensoURL, mei_parser, mei_callback);
});


// everything from here down is a function that is called by something above.

// a function to parse the date strings in the csv file
var dateparser = d3.time.format("%Y%m%d")


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


// apply this function to data for each day
// returns a new associative array
function cumulativePrecipMean(dayOfDataByDay) {
    accessor = function (d) { return d.cumulativePrecip };
    
    out = {};
    out.cumulativePrecip = d3.mean(dayOfDataByDay, accessor);
    out.waterDay = dayOfDataByDay[0].waterDay;
    out.date = dayOfDataByDay[0].date;
    
    return out;
}

function cumulativePrecipMedian(dayOfDataByDay) {
    accessor = function (d) { return d.cumulativePrecip };
    
    out = {};
    out.cumulativePrecip = d3.median(dayOfDataByDay, accessor);
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
    d3.selectAll("#Tucson").call(tucsonChart, dataNested, true)
    d3.selectAll("#Tucson").call(tucsonChart, dataStatsByDay, true)
};


function mei_parser(d) {
    //console.log(d);
    
    d.year = +d.YEAR
    
    return d;
}

function mei_callback(error, rows) {
    console.log(error);
    console.log('retrieved mei data: ', rows);
    
    ensoIndex = d3.nest().key(function(d) { return d.YEAR; }).map(rows);
    
    d3.csv(dataURL, precip_parser, precip_callback);
}

// a function to construct the graph elements.
function initializePlots() {
    
    var chartMetadata = [
         {id:"Tucson", title:"Tucson"},
         ];
    
    newChartDivs = d3.select(dataDiv).selectAll("div .chart")
                    .data(chartMetadata, function(d) { return d.id }).enter();
    newChartDivs.append("div")
                    .attr("class", "chart")
                    .attr("id", function(d){return d.id;})
                .append("div")
                    .attr("class", "chart tooltip");

    var containerWidth = d3.select(dataDiv).node().offsetWidth;
    var size = (typeof size === "undefined") ? scaleFull : size;
    var chartWidth = Math.round(containerWidth*size);
    var chartHeight = Math.round(chartWidth/aspectRatio);
    var margin = calculateMargin(chartWidth);

    tucsonChart = precipChart().width(chartWidth)
                                .height(chartHeight)
                                .margin(margin)
                                .title("Tucson");
    
    charts = [tucsonChart];
    
    chartSelectorMapping = { "#Tucson": tucsonChart }
    
    // populate the graphs with the default data
    chartMetadata.forEach(function(thisMetadata) {
        thisMetadata.chart = chartSelectorMapping["#"+thisMetadata.id]
    });
    
    // draw empty graph
    d3.selectAll("#Tucson").call(tucsonChart, [], true)
}


function calculateMargin(chartWidth) {
    return {top: 50, 
            right: Math.round(chartWidth*0.05), 
            bottom: 45, 
            left: Math.max(80, Math.round(chartWidth*0.15))}
}



