// create a chart function
function precipChart() {

    var dataDiv = "#data";

    // Set up default graph geometry
    // can be changed with chart.width and chart.height
    var containerWidth = d3.select(dataDiv).node().offsetWidth; //document.body.offsetWidth - document.getElementById("leftnav").offsetWidth;
    containerWidth = 1000; //fix for now
    var size = 0.9;
    var containerWidth = Math.round(containerWidth*size);
    var aspectRatio = 16.0/8.0;

    var containingDivId = "#chart";
    var containingSelection;

    var margin = {top: 50,
                  right: Math.round(containerWidth*0.05),
                  bottom: 30,
                  left: Math.round(containerWidth*0.15)};
    var width = Math.round(containerWidth - margin.left - margin.right);
    var height = Math.round(containerWidth/aspectRatio - margin.top - margin.bottom);

    var innerWidth = width - margin.left - margin.right;

    var title = "Cumulative Precipitation";

    // x and y axis set up

    // initialize scales. these functions/objects map data values into pixels.
    // once we have data, we'll assign their domains (input data min/max)
    // and ranges (the pixels that the min/max data should be mapped to)
    //var xScale = d3.scale.linear();
    var xScale = d3.time.scale();
    var yScale = d3.scale.linear();

    // need to define an epoch to plot multiple years on a time axis.
    // an alternative would be to plot against the waterDay but
    // implement a custom x tick and tick label function
    // tmins and tmaxes are inclusive. 0 day is the end of the previous month
    var epochYear = 2015;
    var tmin_cool = new Date(epochYear, 9, 1);
    var tmax_cool = new Date(epochYear+1, 5, 0);
    var tmin_monsoon = new Date(epochYear+1, 5, 1);
    var tmax_monsoon = new Date(epochYear+1, 9, 0);
    var tmin_full = new Date(epochYear, 9, 1);
    var tmax_full = new Date(epochYear+1, 9, 0);
    var months;

    var bisectDate = d3.bisector(function(d) { return d.date; }).left

    var accumulationOffsetDay = -1;

    var xExtent = [tmin_cool, tmax_cool];

    var ymin_cool = 0;
    var ymax_cool = 12;
    var ymin_monsoon = 0;
    var ymax_monsoon = 12;
    var ymin_full = 0;
    var ymax_full = 20;
    var yExtent = [ymin_cool, ymax_cool];
    var autoscale = true;

    // calculate offsets for time zones.
    // not used here?
    var tzUTCoffset = new Date().getTimezoneOffset();
    var tzMSToffset = (420 - tzUTCoffset)*1000*60; //convert to milliseconds
    var tzOffset = tzMSToffset;
    //console.log('MST offset: ', tzMSToffset);

    var customTimeFormat = d3.time.format.multi([
      [".%L", function(d) { return d.getMilliseconds(); }],
      [":%S", function(d) { return d.getSeconds(); }],
      ["%H:%M", function(d) { return d.getMinutes(); }],
      ["%H:00", function(d) { return d.getHours(); }],
      ["%-m/%-d", function(d) { return d.getDate() != 1; }],
      ["%b", function(d) { return d.getMonth(); }],
      ["%b", function(d) { return true; }] // plot 'Jan' instead of year number
    ]);

    var xAxis = d3.svg.axis()
                        .scale(xScale)
                        .orient("bottom")
                        .tickFormat(customTimeFormat)
                        .ticks(d3.time.months);

    var yAxis = d3.svg.axis()
                        .scale(yScale)
                        .orient("left")
                        .ticks(5);

    // define line drawing function
    var line = d3.svg.line()
                    //.x(function(d) { return xScale(d.waterDay); })
                    .x(function(d) { return xScale(getPlotDate(d.date)); })
                    .y(function(d) { return yScale(d.cumulativePrecipPlot); });


    //var xLabel = "Water Year";
    var xLabel = "";
    var yLabel = "Cumulative Precipitation (in)";

    // set up label offsets
    var tzLabelOffset = 40;
    var tzLabelX = function() { return innerWidth - tzLabelOffset };
    var tzLabelY = 40;

    // scope the color bars variables were scoped initially, but
    // defer their assignment until the chart function has been defined.
    // this makes it so that all of the color bar logic is in one place:
    // the chart.colorBinScheme getter/setter function
    var colorDomain;
    var colors;
    var colorScale;
    var colorBins;
    var colorBinLabels;
    var colorBinScheme;

    var barHeight = 20;
    var barWidth = 20;
    var barYOffset = 20;
    var barXOffset = 20;

    var strokeWidthNormal = 1;
    var strokeOpacityNormal = 0.75;
    var strokeWidthHighlighted = 5;
    var strokeOpacityHighlighted = 1;

    var ensoBin = "JANFEB";
    var ensoIndex = 'MEI';

    var ensoIndex;
    var tooltip;

    var enlargeAllowed = false;

    var legendXtranslate = 15;
    var legendYtranslate = 5;

    // these set the y axis limits relative to the max/min measurement values
    var maxExpand = 1.22;
    var minExpand = 1.1;

    //var commonTimes;

    // selection is the parent element automatically passed by d3.selectAll().call()
    function chart(selection, newData, appendToPlot, selectedDatesOnly) {
        //console.log("operating on ", selection);

        selection.each(function(oldData) {
            console.log("oldData: ", oldData);
            console.log("newData.length: ", newData.length, " | newData: ", newData);

            containingSelection = d3.select(containingDivId);

            // Select the svg element, if it exists.
            var svg = containingSelection.selectAll("svg").data([1]);

            // Otherwise, create the skeletal chart.
            // Insert is used to make explanatory text follow the chart.
            var gEnter = svg.enter().insert("svg", ":first-child")
                                    .append("g");

            //console.log(gEnter);

            gEnter = createAxesAndLabels(gEnter);

            gEnter.append("text")
                    .attr("class", "title")

            gEnter = createSeasonControl(gEnter);

            if (enlargeAllowed) {
                gEnter.append("text")
                        .attr("class", "enlarge-shrink-button")
                        .attr("transform", "translate(10, -16)")
                        .text("+")
                        .on("click", chart.enlarge)
                        .on("mouseover", chart.buttonMouseover)
                        .on("mouseout", chart.buttonMouseout);
            }

            if (enlargeAllowed && containingSelection.attr("class").indexOf("zoom") === -1) {
                svg.select(".title")
                    .on("click", chart.enlarge)
                    .on("mouseover", chart.buttonMouseover)
                    .on("mouseout", chart.buttonMouseout);
            }

            // Update the outer dimensions.
            svg.attr("width", width)
               .attr("height", height);

            // Update the inner dimensions.
            var g = svg.select("g")
                        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
            innerWidth = width - margin.left - margin.right;

            g = enterUpdateColorbar(g);

            // DATA JOIN
            // Join new data with old, if any.
            // The result is the UPDATE selection which applies to
            // the ***overlap*** between the new and the old data,
            // and contains references to the ENTER and EXIT selections.
            var linesUpdate = g.selectAll("g.gen_data")
                                    .data(newData, function(d) {return d.key});
            console.log("update selection: ", linesUpdate);

            // ENTER
            // Applies to the new data only.
            // Create new g's with paths and text inside of them
            // but don't compute the lines until the unwanted data is removed
            // and new axes are calculated
            var linesEnter = linesUpdate.enter().insert("g", ".axis")
                                                    .attr("class", "gen_data");
            console.log("enter selection: ", linesEnter);

            linesEnter.append("path")
                        .on("mouseover", chart.lineMouseover)
                        .on("mousemove", chart.lineMousemove)
                        .on("mouseout", chart.lineMouseout)
                        .on("click", chart.lineClick);

            // EXIT
            // Applies to the old data only
            // Remove old lines if needed
            if (!appendToPlot) {
                linesUpdate.exit().remove()
            }

            // New selection with all remaining lines
            // Need to select in this order so that new data that was
            // bound to the g.gen_data elements gets propagated
            // down to the path elements
            var remainingLines = g.selectAll("g.gen_data").select("path");
            console.log("remainingLines: ", remainingLines);

            // calculate cumulative precip based on plot start date
            remainingLines.each(rezeroAccumulation)

            if (autoscale) {
                var ymin, ymax;
                ymax = d3.max(remainingLines.data(), function(d) {
                    return d.cumulativePrecipPlotMax; })
                yExtent = [0, ymax];
            }

            console.log("xExtent: ", xExtent);
            console.log("yExtent: ", yExtent);

            // Update the x-scale.
            xScale.domain(xExtent)
                  .range([0, innerWidth]);

            // Update the y-scale.
            yScale.domain(yExtent)
                  .range([height - margin.top - margin.bottom, 0]);


            // finally draw/redraw the lines using the new scale
            remainingLines.attr("d", function(d) {
                return line(d.values
                                .filter(function(d2) {
                                    var plotDate = getPlotDate(d2.date);
                                    return (xExtent[0] <= plotDate) && (plotDate <= xExtent[1]);
                                })
                            )})
                          .attr("class", "line")
                          .attr("stroke", getENSOcolor )
                          .attr("stroke-width", get_strokeWidthNormal)
                          .attr("stroke-opacity", get_strokeOpacityNormal);

            // redraw x axis
            g.select(".x.axis")
                .attr("transform", "translate(0," + yScale.range()[0] + ")")
                .call(xAxis);

            // redraw y axis
            g.select(".y.axis")
                .call(yAxis);

            // update title position
            g.select(".title")
                .attr("x", (innerWidth / 2))
                .attr("y", -25)
                .attr("text-anchor", "middle")
                .text(title);

            // update tz label position
            g.select(".x.axis text")
                .attr("dx", tzLabelX())

            // distinguish between redraws and loads
            if (newData.length > 0) {
                //hideLoadingDialog();
            }

            // nest data by stats vs. years, then by decade
            var nestedYears = d3.nest().key(function (d) { return (d.key === 'mean' || d.key === 'median') ? 'statistics' : 'years'; })
                                       .key(function (d) { return Math.floor((+d.key-11)/20); })
                                       .entries(newData);

            console.log("nestedYears: ", nestedYears);

            // create a div, if necessary, to hold the two tables
            // this allows both tables to be left
            // justified within a centered div.
            containingSelection.selectAll("div#tables").data([1])
                                                        .enter()
                                                         .append("div")
                                                         .attr("id", "tables")
                                                         .attr("class", "year-selector")

            // select and possibly create table DOM elements for years and stats
            var table = d3.select("#tables").selectAll("table").data(nestedYears,
                                                                     function(d) { return d.key; });
            table.enter()
                    .append("table")
                    .attr("id", function (d) { return d.key; })

            // create rows based on propagated data
            var tr = table.selectAll("tr").data(function(d) { return d.values })
            tr.enter()
                .append("tr");

            // create cells within rows based on propagated data
            var td = tr.selectAll("td").data(function (d) { return d.values; },
                                             function (d2) { return d2.key; } );
            td.enter()
                .append("td")
                .html(function(d) {return d.key})
                .style("color", getENSOcolor )
                .on("click", chart.tableYearClick)
                .on("mouseover", chart.tableYearMouseover)
                .on("mouseout", chart.tableYearMouseout);

        }); // end of selection.each()
    }; // end of chart()


    function createAxesAndLabels(gEnter) {
        // build axes and labels
        gEnter.append("g")
                .attr("class", "x axis")
              .append("text")
                .attr("text-anchor", "middle")
                .attr("dx", tzLabelX)
                .attr("dy", tzLabelY)
                .text(xLabel);

        gEnter.append("g")
                .attr("class", "y axis")
              .append("text")
                .attr("transform", "rotate(-90)")
                .attr("y", 6)
                .attr("dy", "-4.5em")
                .style("text-anchor", "end")
                .text(yLabel);

        return gEnter;
    }

    function enterUpdateColorbar(g) {
        // create colorbar for legend
        // http://tributary.io/tributary/3650755/

        // the chart variables were scoped initially, but not defined
        // so run the scheme code, if necessary.
        // this makes it so that all of the logic is in one place.
        if (typeof(colorBinScheme) === 'undefined') {
            chart.colorBinScheme('default');
        }

        var bars = g.selectAll("rect.colorbar").data(colorBins)
        bars.enter()
            .append("rect")
            .attr("class", "colorbar")
        bars.attr({
                    width: barWidth,
                    height: barHeight,
                    y: function(d,i) {
                      return i * barHeight + barYOffset;
                    },
                    x: barXOffset,
                    fill: function(d,i) {
                      return colorScale(d+.0001);
                    }
                  })
        bars.exit().remove();

        var labels = g.selectAll("text.colorbarlabels").data(colorBinLabels)
        labels.enter()
              .append("text")
              .attr("class", "colorbarlabels")
        labels.attr({
                    y: function(d,i) {
                      return (i+0.25) * barHeight + barYOffset;
                    },
                    x: barXOffset + 35 + barWidth,
                  })
                .style("text-anchor", "end")
                .text(function(d,i) { return parseFloat(d).toFixed(2) });
        labels.exit().remove()

        var title = g.selectAll("text#legend-title").data([chart.ensoIndex()])
        title.enter()
            .append("text")
            .attr("id", "legend-title")
        title.attr({x: barXOffset , y:barYOffset-barHeight/2})
            .text(function (d) { return d; })

        return g
    }

    function createSeasonControl(gEnter) {
        var seasonXOffset = 100;
        var seasonYOffset = 20;
        var spacing = 20;

        var seasonData = [{"season":"Cool season", "func":chart.coolSeason, "dflt":"true"},
                          {"season":"Monsoon season", "func":chart.monsoonSeason},
                          {"season":"Full year", "func":chart.fullYear}]

        var seasons = gEnter.selectAll("text.seasonControl").data(seasonData).enter()
        seasons.append("text")
            .attr({
                x: seasonXOffset,
                y: function(d,i) { return i * spacing + seasonYOffset }
                })
            .text(function(d){return d.season})
            .attr("class", "season-control")
            .attr("fill", function(d) { return (typeof(d.dflt) === "undefined") ? "gray" : "black"} )
            .on("click", function(d) { d.func() } )
        return gEnter;
    }

    function rezeroAccumulation(d) {
        var startprecip;
        var endprecip
        var startDate = new Date(xExtent[0]);
        var endDate = new Date(xExtent[1]);

        var year
        if (d.key == 'mean' || d.key == 'median') {
            year = d.values[0].date.getFullYear() + 1;
        } else {
            year = +d.key;
        }

        startYear = startDate.getMonth() > 8 ? year - 1 : year;
        endYear = endDate.getMonth () > 8 ? year - 1 : year;

        startDate.setYear(startYear); // does not work with setFullYear for some reason
        endDate.setYear(endYear);
        //console.log(startDate, endDate);

        // need to be careful since bisect will not return -1
        if (+startDate == +d.values[0].date) {
            startprecip = 0;
        } else {
            var index = bisectDate(d.values, startDate) - 1;
            startprecip = d.values[index].cumulativePrecip;
            //console.log('bisected dates. d.key: ', d.key, 'search date: ', startDate, ' index: ', index, ' startprecip: ', startprecip);
        }

        var index = bisectDate(d.values, endDate) - 1;
        endprecip = d.values[index].cumulativePrecip;
        //console.log('bisected dates. d.key: ', d.key, 'search date: ', startDate, ' index: ', index, ' endprecip: ', endprecip);

        d.values.forEach(function(d2, i) {
            d2.plotDate = getPlotDate(d2.date);
            d2.cumulativePrecipPlot = d2.cumulativePrecip - startprecip;
        })

        // store for later use with autoscaling
        d.cumulativePrecipPlotMax = endprecip - startprecip;
    }

    function getMaxVisible(d) {
        var endprecip;
        var date = new Date(xExtent[1]);

        var year;
        if (d.key == 'mean' || d.key == 'median') {
            year = d.values[0].date.getFullYear() + 1;
        } else {
            year = +d.key;
        }
        year = date.getMonth() > 8 ? year - 1 : year;

        date.setYear(year); // does not work with setFullYear for some reason
        //console.log(date);

        // need to be careful since bisect will not return -1
        if (+date == +d.values[0].date) {
            startprecip = 0;
        } else {
            var index = bisectDate(d.values, date) - 1;
            endprecip = d.values[index].cumulativePrecip;
            //console.log('bisected dates. d.key: ', d.key, 'search date: ', date, ' index: ', index, ' startprecip: ', startprecip);
        }

    }

    // function that enables year wrapping
    function getPlotDate(d) {
        var year = d.getMonth() > 8 ? epochYear : epochYear + 1;
        return (new Date(d)).setFullYear(year);
    }

    chart.ensoBin = function(_) {
        if (!arguments.length) return ensoBin;
        _ = _.toUpperCase();
        if (chart.ensoIndex() === 'MEI' &&
            typeof(ensoIndexData["2014"][0][_]) === 'undefined') {
            throw 'invalid ensoBin for MEI';
        } else if (chart.ensoIndex() === 'ONI' &&
                   typeof(ensoIndexData["2014"][0][_]) === 'undefined') {
            throw 'invalid ensoBin for ONI';
        }
        ensoBin = _;
        return chart;
    }

    function getENSOvalue(d) {
        var ensoval;

        if (d.key == 'mean' || d.key == 'median') {
            return 'N/A';
        } else if (d.key == '2016' && ensoIndex == 'MEI') {
            ensoval = 2.202
        } else if (d.key == '2016' && ensoIndex == 'ONI') {
            ensoval = 2.3
        } else {
            ensoval = parseFloat(ensoIndexData[d.key][0][ensoBin])
        }
        return ensoval.toFixed(2);
    }

    function getENSOcolor(d) {
        if (d.key == 'mean' || d.key == 'median') {
            return 'black';
        } else {
            return colorScale(getENSOvalue(d));
        }
    }

    function get_strokeWidthNormal(d) {
        if (d.key == 'mean' || d.key == 'median') {
            return 2;
        } else {
            return strokeWidthNormal;
        }
    }

    function get_strokeOpacityNormal(d) {
        if (d.key == 'mean' || d.key == 'median') {
            return 1;
        } else {
            return strokeOpacityNormal;
        }
    }

    // accessor methods
    chart.margin = function(_) {
        if (!arguments.length) return margin;
        margin = _;
        innerWidth = width - margin.left - margin.right;
        return chart;
    };

    chart.width = function(_) {
        if (!arguments.length) return width;
        width = _;
        innerWidth = width - margin.left - margin.right;
        return chart;
    };

    chart.height = function(_) {
        if (!arguments.length) return height;
        height = _;
        return chart;
    };

    chart.size = function(_) {
        if (!arguments.length) return size;
        size = _;
        return chart;
    };

    chart.aspectRatio = function(_) {
        if (!arguments.aspectRatio) return size;
        aspectRatio = _;
        return chart;
    };

    chart.title = function(_) {
        if (!arguments.length) return title;
        title = _;
        return chart;
    };

    chart.innerWidth = function(_) {
        if (!arguments.length) return innerWidth;
        innerWidth = _;
        return chart;
    };

    chart.containingDivId = function(_) {
        if (!arguments.length) return containingDivId;
        containingDivId = _;
        return chart;
    };

    chart.tzOffset = function(_) {
        if (!arguments.length) return tzOffset;
        tzOffset = _;
        return chart;
    };

    chart.xExtent = function(_) {
        if (!arguments.length) return xExtent;
        xExtent = _;
        tmin = xExtent[0];
        tmax = xExtent[1];
        return chart;
    }

    chart.yExtent = function(_) {
        if (!arguments.length) return yExtent;
        yExtent = _;
        ymin = yExtent[0];
        ymax = yExtent[1];
        return chart;
    }

    chart.xScale = function(_) {
        if (!arguments.length) return xScale;
        xScale = _;
        return chart;
    }

    chart.yScale = function(_) {
        if (!arguments.length) return yScale;
        yScale = _;
        return chart;
    }

    chart.autoscale = function(_) {
        if (!arguments.length) return autoscale;
        autoscale = _;
        return chart;
    }

    chart.coolSeason = function() {
        accumulationOffsetDay = -1;

        xExtent = [tmin_cool, tmax_cool];
        yExtent = [ymin_cool, ymax_cool];

        seasonsControls = d3.selectAll(".season-control");
        seasonsControls
            .filter(function(d) { return d.season.toLowerCase().indexOf("cool") > -1 })
            .attr("fill", "black")
        seasonsControls
            .filter(function(d) { return d.season.toLowerCase().indexOf("cool") == -1 })
            .attr("fill", "gray")

        return chart.redraw();
    }

    chart.monsoonSeason = function() {
        accumulationOffsetDay = 242;

        xExtent = [tmin_monsoon, tmax_monsoon];
        yExtent = [ymin_monsoon, ymax_monsoon];

        seasonsControls = d3.selectAll(".season-control");
        seasonsControls
            .filter(function(d) { return d.season.toLowerCase().indexOf("monsoon") > -1 })
            .attr("fill", "black")
        seasonsControls
            .filter(function(d) { return d.season.toLowerCase().indexOf("monsoon") == -1 })
            .attr("fill", "gray")

        return chart.redraw();
    }

    chart.fullYear = function() {
        accumulationOffsetDay = -1;

        xExtent = [tmin_full, tmax_full];
        yExtent = [ymin_full, ymax_full];

        seasonsControls = d3.selectAll(".season-control");
        seasonsControls
            .filter(function(d) { return d.season.toLowerCase().indexOf("full") > -1 })
            .attr("fill", "black")
        seasonsControls
            .filter(function(d) { return d.season.toLowerCase().indexOf("full") == -1 })
            .attr("fill", "gray")

        return chart.redraw();
    }

    chart.months = function(_) {
        if (!arguments.length) return months;

        months = _
        startMonth = months[0];
        endMonth = months[1]

        accumulationOffsetDay = -1;

        //year = startDate.getMonth() > 8 ? year : year;
        //year = endDate.getMonth() > 8 ? year - 1 : year;

        // Convert standard calendar indexing to Javascript indexing
        startMonth = startMonth - 1;

        // No conversion for endMonth since it is inclusive
        endMonth = endMonth;

        endMonth = endMonth > 8 ? endMonth : endMonth + 12;

        if (startMonth > 8) {
            year = epochYear
        } else {
            year = epochYear + 1
            endMonth = endMonth - 12; // undo what we did above
        }

        console.log('startMonth: ', startMonth, ' endMonth: ', endMonth, ' year: ', year)

        tmin = new Date(year, startMonth)
        tmax = new Date(year, endMonth, 0)

        xExtent = [tmin, tmax];

        seasonsControls = d3.selectAll(".season-control")
                             .attr("fill", "gray")

        return chart;
    }

    chart.ensoIndex = function(_) {
        if (!arguments.length) return ensoIndex;
        ensoIndex = _.toUpperCase();
        ensoIndexData = ensoIndexMapping[ensoIndex];

        return chart;
    }

    chart.accumulationOffsetDay = function(_) {
        if (!arguments.length) return accumulationOffsetDay;
        accumulationOffsetDay = _;
        return chart;
    }

    chart.colorScale = function(_) {
        if (!arguments.length) return colorScale;
        colorScale = _;
        return chart;
    }

    chart.colorBins = function() {
        if (!arguments.length) return colorBins;
        colorBins = _;
        return chart;
    }

    chart.colorBinLabels = function() {
        if (!arguments.length) return colorBinLabels;
        colorBinLabels = _;
        return chart;
    }

    chart.colorDomain = function() {
        if (!arguments.length) return colorDomain;
        colorDomain = _;
        return chart;
    }

    chart.colors = function() {
        if (!arguments.length) return colors;
        colors = _;
        return chart;
    }

    chart.colorBinScheme = function(_) {
        if (!arguments.length) return colorBinScheme;
        _ = _.toLowerCase();
        var white = "#f5f5f5"; // colorbrewer RuBl9 default is f7f7f7
        var white = "#f1f1f1";
        if (_ === "default") {
            colorBinScheme = _;
            colorDomain = [-2.25,2.25];
            colors = ["#b2182b", "#d6604d", "#f4a582", "#fddbc7", white, "#d1e5f0", "#92c5de", "#4393c3", "#2166ac"]
        } else if (_ === "noaa") {
            colorBinScheme = _;
            colorDomain = [-2.5,2.5];
            colors = ["#b2182b", "#d6604d", "#f4a582", "#fddbc7", white, white, "#d1e5f0", "#92c5de", "#4393c3", "#2166ac"]
        } else {
            throw "invalid colorScheme";
        }

        colorScale = d3.scale.quantize().domain(colorDomain).range(colors);

        // the values at which the color bins will be evaluated.
        // add a little bit to the divider values to remove float weirdness.
        var eps = .0000001;
        colorBins = colors.map(function(d){return colorScale.invertExtent(d)[0]+eps});
        // the labels for the color bins
        colorBinLabels = colors.map(function(d){return colorScale.invertExtent(d)[0]});
        colorBinLabels.push(colorScale.invertExtent(colors[colors.length-1])[1]);

        if (colorBinScheme === "noaa") {
            colorBinLabels[5] = 0.00;
        }

        colorBins.reverse();
        colorBinLabels.reverse();

        return chart;
    }

    chart.reset = function() {
        chart.ensoIndex('mei').ensoBin('janfeb').colorBinScheme('default').redraw()
    }

    chart.redraw = function() {
        containingSelection = d3.select(containingDivId);
        containingSelection.call(chart, [], true);
        d3.selectAll("text.end-of-year-data").each(updateEndOfYearText);
        return chart;
    };

    chart.enlargeAllowed = function(_) {
        if (!arguments.length) return enlargeAllowed;
        enlargeAllowed = _;

        // if graph exists on the page, select it, otherwise, return.
        try {
            containingSelection = d3.select(containingDivId);
        } catch (SyntaxError) {
            return chart;
        }

        // graph exists, so set the appropriate zoom behavior.
        if (enlargeAllowed && containingSelection.attr("class").indexOf("zoom") === -1) {
            containingSelection.select(".title").on("click", chart.enlarge);
        } else {
            containingSelection.select(".title").on("click", function () {return});
        }
        return chart;

    };

    chart.enlarge = function() {
        width = 2*width;
        height = 2*height;
        containingSelection = d3.select(containingDivId);
        containingSelection.call(chart, [], true);
        containingSelection.select(".title").on("click", chart.shrink);
        containingSelection.select(".enlarge-shrink-button").text("-").on("click", chart.shrink)
        //mostRecentSelection.select("svg").on("click", chart.shrink);
        containingSelection.attr("class", "chart zoom");
        d3.selectAll(".chart:not("+containingDivId+")").style("display", "none");
        containingSelection.selectAll(".download").style("display", "inline");
        d3.selectAll(".tooltip").style("display", "inline");
        activeGraphId = containingDivId;
        activeChart = chart;
        //d3.selectAll(".chart:not(#"+mostRecentSelection.attr("id")+")").style("opacity", "0.2");
        return chart;
    };

    chart.shrink = function() {
        //displayDashboard()
        containingSelection = d3.select(containingDivId);
        containingSelection.select(".title").on("click", chart.enlarge);
        containingSelection.select(".enlarge-shrink-button").text("+").on("click", chart.enlarge)
        width = 0.5*width;
        height = 0.5*height;
        containingSelection.call(chart, [], true);
        containingSelection.select(".title").on("click", chart.enlarge);
        //mostRecentSelection.select("svg").on("click", chart.enlarge);
        containingSelection.attr("class", "chart");
        //d3.selectAll(".chart").style("opacity", "1");
        d3.selectAll(".chart").style("display", "inline");
        return chart;
    };

    function invertxpnt(xpnt, d) {
        var xval = xScale.invert(xpnt);

        var date = chart.plotDateToRealDate(xval, d);

        var index = bisectDate(d.values, date) - 1;

        var out = {}
        out.waterDay = index
        out.date = date;
        //console.log(out);

        return out;
    }

    function invertxDate(plotDate, d) {
        var date = chart.plotDateToRealDate(plotDate, d);

        var index = bisectDate(d.values, date) -1;

        var out = {}
        out.waterDay = index
        out.date = date;
        //console.log(out);

        return out;
    }

    chart.plotDateToRealDate = function (xval, d) {
        var date = new Date(xval)
        //console.log(date);
        date.setHours(12)
        date.setMinutes(0)
        date.setSeconds(0);

        var year
        if (d.key == 'mean' || d.key == 'median') {
            year = d.values[0].date.getFullYear() + 1;
        } else {
            year = +d.key;
        }
        year = date.getMonth() > 8 ? year - 1 : year;

        date.setFullYear(year);

        return date;
    }

    // functions for making the tool tip work
    chart.lineMouseover = function (d, i) {
        setCursor("crosshair"); // [jd:] trying an improved UI
        var thisLine = d3.select(this);
        var thisLineData = thisLine.data()[0];
        //console.log(thisLineData);

        thisLine.style("stroke-width", strokeWidthHighlighted);
        thisLine.style("stroke-opacity", strokeOpacityHighlighted);

        //console.log(this)

        // I think that this can be removed since lineMousemove should also get called
        var point = d3.mouse(this);

        var xdata = invertxpnt(point[0], thisLineData);

        var yval = thisLineData.values[xdata.waterDay].cumulativePrecipPlot;
        var yval = parseFloat(yval).toFixed(2) + " in";

        var dailyPrecip = thisLineData.values[xdata.waterDay].precip;
        dailyPrecip = parseFloat(dailyPrecip).toFixed(2) + " in";

        var ensoval = getENSOvalue(thisLineData);

        //var text = createTooltipText(thisLineData.key, String(yval), 'Day '+xdata.waterDay, 'MEI: '+ensoval, xdata.date);
        var text = createTooltipText(thisLineData.key, xdata.date, xdata.waterDay, yval, dailyPrecip, ensoval);

        var tooltip = d3.select(this.parentNode.parentNode.parentNode.parentNode).select(".tooltip");
        tooltip.html(text)
                .style("visibility", "visible");
    };

    chart.lineMousemove = function (d, i) {
        var thisLine = d3.select(this);
        var thisLineData = thisLine.data()[0];
        var point = d3.mouse(this);

        var xdata = invertxpnt(point[0], thisLineData);

        var yval = thisLineData.values[xdata.waterDay].cumulativePrecipPlot;
        yval = parseFloat(yval).toFixed(2) + " in";

        var dailyPrecip = thisLineData.values[xdata.waterDay].precip;
        dailyPrecip = parseFloat(dailyPrecip).toFixed(2) + " in";

        var ensoval = getENSOvalue(thisLineData);

        var text = createTooltipText(thisLineData.key, xdata.date, xdata.waterDay, yval, dailyPrecip, ensoval);

        var tooltip = d3.select(this.parentNode.parentNode.parentNode.parentNode).select(".tooltip");

        var tooptipOffset = 5;
        tooltip.style("top", (d3.event.clientY + tooptipOffset)+"px")
               .style("left", (d3.event.clientX + tooptipOffset)+"px")
               .html(text);
    };

    chart.lineMouseout = function (d, i) {
        setCursor("default");
        var tooltip = d3.select(this.parentNode.parentNode.parentNode.parentNode).select(".tooltip");
        var thisSelection = d3.select(this)

        var active = d3.select(this.parentNode).classed("active");
        if (!active) {
            thisSelection.style("stroke-width", get_strokeWidthNormal);
            thisSelection.style("stroke-opacity", get_strokeOpacityNormal);
        }

        tooltip.style("visibility", "hidden");
    };

    chart.lineClick = function(d, i) {
        var thisSelection = d3.select(this.parentNode) // select the g instead of the path
        var active = thisSelection.classed("active");
        thisSelection.classed("active", !active);

        var data = thisSelection.data()[0];

        var yearText = d3.select(containingDivId).selectAll("td")
                        .filter(function(d) { return d.key == data.key })

        yearText.classed("active", !active);

        if (!active) {
            addEndOfYearText(data, thisSelection);
        } else {
            thisSelection.select("text.end-of-year-data").remove()
        }
    }

    chart.tableYearClick = function (d, i) {
        var thisSelection = d3.select(this)
        var active = thisSelection.classed("active");
        thisSelection.classed("active", !active);

        var data = thisSelection.data()[0];

        var yearLineg = d3.select(containingDivId).selectAll("g.gen_data")
                        .filter(function(d) { return d.key == data.key })

        yearLineg.classed("active", !active);
    }

    chart.tableYearMouseover = function (d, i) {
        var thisSelection = d3.select(this)

        var data = thisSelection.data()[0];

        //console.log(data);

        var yearLineg = d3.select(containingDivId).selectAll("g.gen_data")
                            .filter(function(d) { return d.key == data.key })

        var yearLine = yearLineg.select("path");

        //console.log("tableYearMouseover yearLine: ", yearLine);

        yearLine.style("stroke-width", strokeWidthHighlighted);
        yearLine.style("stroke-opacity", strokeOpacityHighlighted);

        addEndOfYearText(data, yearLineg);
    }

    chart.tableYearMouseout = function (d, i) {
        var thisSelection = d3.select(this)
        var active = thisSelection.classed("active");
        //thisSelection.classed("active", !currentClass);

        var data = thisSelection.data()[0];

        if (!active) {
            var yearLineg = d3.select(containingDivId).selectAll("g.gen_data")
                                .filter(function(d) { return d.key == data.key })

            var yearLine = yearLineg.select("path");
            //console.log("tableyearMouseexit yearLine: ", yearLine);

            yearLine.style("stroke-width", get_strokeWidthNormal);
            yearLine.style("stroke-opacity", get_strokeWidthNormal);
            yearLine.classed("active", false);

            // could use an exit selection, but this works
            yearLineg.select("text.end-of-year-data").remove()
        } else {
            //console.log("tableyearMouseexit. active was true for ", data.key);
        }
    }

    function addEndOfYearText(data, yearLineg) {
        var xdata = invertxDate(xExtent[1], data);
        //console.log(xdata);

        var yval = data.values[xdata.waterDay].cumulativePrecipPlot;
        yvalText = parseFloat(yval).toFixed(2) + " in";
        var ensoval = chart.ensoIndex() + " " + getENSOvalue(data);

        var text = data.key + ". " + yvalText + ", " + ensoval;
        //console.log(text);

        // only append if does not exist
        yearLineg.selectAll("text.end-of-year-data").data([1]).enter()
                 .append("text")
                 .attr({x: xScale(xExtent[1])+2, y:yScale(yval)+5})
                 .attr("class", "end-of-year-data")
                 .text(text);
    }

    function updateEndOfYearText(textSelection) {
        var yearLineg = d3.select(this.parentNode);

        var data = yearLineg.data()[0]

        var xdata = invertxDate(xExtent[1], data);
        //console.log(xdata);

        var yval = data.values[xdata.waterDay].cumulativePrecipPlot;
        yvalText = parseFloat(yval).toFixed(2) + " in";
        var ensoval = chart.ensoIndex() + " " + getENSOvalue(data);

        var text = data.key + ". " + yvalText + ", " + ensoval;
        //console.log(text);

        yearLineg.select("text.end-of-year-data")
                 .attr({x: xScale(xExtent[1])+2, y:yScale(yval)+5})
                 .text(text);
    }

    chart.buttonMouseover = function(d,i) {
        var thisSelection = d3.select(this);
        var labelText = labelMapping[thisSelection.attr("class")];
        //console.log("buttonMouseover: ", labelText);

        var tooltip = d3.select(containingDivId).select(".tooltip");
        var tooptipOffset = 5;
        tooltip.style("visibility", "visible")
               .style("top", (d3.event.clientY + tooptipOffset)+"px")
               .style("left", (d3.event.clientX + tooptipOffset)+"px")
               .html(labelText);

        if (thisSelection.attr("class") === "download clickline") {
            var newSelection = d3.select(this.parentNode).select("svg polygon");
            //console.log(newSelection);
            newSelection.attr("fill", "#0972a5").attr("stroke", "#0972a5")
        }
    }

    chart.buttonMouseout = function(d,i) {
        var thisSelection = d3.select(this);
        var labelText = labelMapping[thisSelection.attr("class")];
        //console.log("buttonMouseout: ", labelText);

        var tooltip = d3.select(containingDivId).select(".tooltip");
        tooltip.style("visibility", "hidden");

        if (thisSelection.attr("class") === "download clickline") {
            var newSelection = d3.select(this.parentNode).select("svg polygon");
            //console.log(newSelection);
            newSelection.attr("fill", "black").attr("stroke", "black")
        }
    }

    return chart;
}


var tooltipDateFormatter = d3.time.format('%b %d');

function createTooltipText(name, date, day, precip, dailyPrecip, enso) {
    // [jd:] move this logic to a function to only have to manipulate once
    sRet = '';
    sRet += '<div class="tooltip-name">' + name + "</div>";
    sRet += '<div class="tooltip-date">' + tooltipDateFormatter(date) + '</div>';
//     sRet += '<div class="tooltip-date">' + 'Day ' + day + '</div>';
    sRet += '<div class="tooltip-value">' + '1 Day Precip: ' + dailyPrecip + '</div>';
    sRet += '<div class="tooltip-value">' + 'Cumulative Precip: ' + precip + '</div>';
    sRet += '<div class="tooltip-value">' + chart.ensoIndex() + ': ' + enso + '</div>';

    return sRet;
}

function setCursor(cursor) {
    d3.select("body").style("cursor", cursor);
}