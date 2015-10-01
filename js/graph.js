// create a chart function 
function precipChart() {
    
    var dataDiv = "#data";
    var containerWidth = d3.select(dataDiv).node().offsetWidth; //document.body.offsetWidth - document.getElementById("leftnav").offsetWidth;
    containerWidth = 1000; //fix for now
    var size = 0.8;
    var containerWidth = Math.round(containerWidth*size);
    var aspectRatio = 16.0/8.0;
    
    var containingDivId = "#Tucson";
    var containingSelection;
    
    // Set up graph variables/functions
    var margin = {top: 50, 
                  right: Math.round(containerWidth*0.05), 
                  bottom: 30, 
                  left: Math.round(containerWidth*0.15)};
    var width = Math.round(containerWidth - margin.left - margin.right);
    var height = Math.round(containerWidth/aspectRatio - margin.top - margin.bottom);
    
    var innerWidth = width - margin.left - margin.right;
    
    var title = "chart title";
    
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
    var epochYear = 2015;
    var tmin_cool = new Date(epochYear, 9, 1);
    var tmax_cool = new Date(epochYear+1, 4, 0);
    var tmin_monsoon = new Date(epochYear+1, 5, 1);
    var tmax_monsoon = new Date(epochYear+1, 9, 0);
    var tmin_full = new Date(epochYear, 9, 1);
    var tmax_full = new Date(epochYear+1, 9, 0);
    
    var xExtent = [tmin_cool, tmax_cool];
    
    var ymin_cool = 0;
    var ymax_cool = 12;
    var ymin_monsoon = 0;
    var ymax_monsoon = 12;
    var ymin_full = 0;
    var ymax_full = 20;
    var yExtent = [ymin_cool, ymax_cool];
    
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
                        .ticks(10);

    var yAxis = d3.svg.axis()
                        .scale(yScale)
                        .orient("left")
                        .ticks(5);

    // define line drawing function
    var line = d3.svg.line()
                    //.x(function(d) { return xScale(d.waterDay); })
                    .x(function(d) { return xScale(getPlotDate(d.date)); })
                    .y(function(d) { return yScale(d.cumulativePrecip); });
                    
                    
    var xLabel = "Water Year";
    var yLabel = "Cumulative Precipitation (in)";
    
    // set up label offsets
    var tzLabelOffset = 40;
    var tzLabelX = function() { return innerWidth - tzLabelOffset };
    var tzLabelY = 40;
    
    
    // construct the color scale (the code, not the legend)
    //var colors =['#2D8098', '#2A6778', '#274E5A', '#24363A', '#212121', '#4D2426', '#7F262E', '#B22833', '#E42A38'].reverse()
    var colors = colorbrewer.RdYlBu[10]
//     var colorDomain = [-2.5,2.5];
    var colorDomain = [-2.25,2.25];
//     var colorDomain = [-2,2];
    var colorScale = d3.scale.quantize().domain(colorDomain).range(colors);
    
    // make stuff for legend.
    // the values at which the color bins will be evaluated.
    // add a little bit to the divider values to remove float weirdness.
    var eps = .0000001;
    var colorBins = colors.map(function(d){return colorScale.invertExtent(d)[0]+eps});
    // the labels for the color bins
    var colorBinLabels = colors.map(function(d){return colorScale.invertExtent(d)[0]});
    colorBinLabels.push(colorScale.invertExtent(colors[colors.length-1])[1]);
    
    var strokeWidthNormal = 1;
    var strokeOpacityNormal = 0.75;
    var strokeWidthHighlighted = 5;
    var strokeOpacityHighlighted = 1;
    
    var ensoBin = "JANFEB";   
    
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
        console.log("operating on ", selection);
        
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
            
            gEnter.append("text")
                    .attr("class", "title") 
            
            gEnter = createColorbar(gEnter);
            
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
                        .on("mouseout", chart.lineMouseout);
            
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
            
            // set up x and y axes
            // arrays to dump mins and maxes in
            var tmins = [];
            var tmaxes = [];
            var ymins = [0];
            var ymaxes = [];
            var ymin, ymax;
            
            // loop through selection to find min/max values for each data set
//             remainingLines.each( function (d) {
//                 
//                 ymin = d3.min(d.data, function(d) { return d.precip; });
//                 ymax = d3.max(d.data, function(d) { return d.precip; });
//                 
//                 tmins.push(d3.min(d.data, function(d) { return d.time; }));
//                 tmaxes.push(d3.max(d.data, function(d) { return d.time; }));
//             
//                 d3.select(this).attr("min", ymin)
//                 d3.select(this).attr("max", ymax)
//                 ymins.push(ymin);
//                 ymaxes.push(ymax);
//                 //ymaxes.push(d.peak_power);
//             });
//             
//             if (selectedDatesOnly) {
//                 var format = d3.time.format("%Y-%m-%d");
//                 tmin = format.parse(startDateVal);
//                 tmax = format.parse(endDateVal);
//             } else {
//                 tmin = d3.min(tmins, function(d) { return d; });
//                 tmax = d3.max(tmaxes, function(d) { return d; });
//                 tmin = tmin ? d3.time.day.floor(tmin) : 0;
//                 tmax = tmax ? d3.time.day.ceil(tmax) : 0;
//             }
           //tmin = 0; tmax = 210;
//             xExtent = [tmin, tmax];
            console.log("xExtent: ", xExtent);
            
//             ymin = d3.min(ymins, function(d) { return d; });
//             ymax = d3.max(ymaxes, function(d) { return d; });
//             if (typeof ymax === "undefined") {
//                 ymax = 1000;
//             }
//             yExtent = [ymin*minExpand, ymax*maxExpand];
//             yExtent = [0, 12];
            console.log("yExtent: ", yExtent);
            
            // Update the x-scale. 
            xScale.domain(xExtent)
                  .range([0, innerWidth]);

            // Update the y-scale.
            yScale.domain(yExtent)
                  .range([height - margin.top - margin.bottom, 0]);
                
            // finally draw/redraw the lines using the new scale
            remainingLines.attr("d", function(d) {
                return line(d.values.filter(function(d2) { return getPlotDate(d2.date) < xExtent[1] }) )
                         })
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
        }); // end of selection.each()
    }; // end of chart()
    
    function createColorbar(gEnter) {
        // create colorbar for legend
        // http://tributary.io/tributary/3650755/
        var barHeight = 20;
        var barWidth = 20;
        var barYOffset = 20;
        var barXOffset = 20;
        
        var bars = gEnter.selectAll("rect.colorbar").data(colorBins.reverse()).enter()
        bars.append("rect")
                .attr({
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
        
        var labels = gEnter.selectAll("text.colorbarlabels").data(colorBinLabels.reverse()).enter()
        labels.append("text")
                .attr({
                    y: function(d,i) {
                      return (i+0.25) * barHeight + barYOffset;
                    },
                    x: barXOffset + 35 + barWidth,
                  })
                .style("text-anchor", "end")
                .text(function(d,i) { console.log(d); return parseFloat(d).toFixed(2) });
        gEnter.append("text")
            .attr({x: barXOffset , y:barYOffset-barHeight/2})
            .text('MEI')
        
        return gEnter
    }
    
    function createSeasonControl(gEnter) {
        var seasonXOffset = 100;
        var seasonYOffset = 20;
        var spacing = 20;
        
        var seasonData = [{"season":"Cool season", "func":chart.coolSeason },
                          {"season":"Full year", "func":chart.fullYear }]
        
        var seasons = gEnter.selectAll("text.seasonControl").data(seasonData).enter()
        seasons.append("text")
            .attr({
                x: seasonXOffset,
                y: function(d,i) { return i * spacing + seasonYOffset }
                })
            .text(function(d){return d.season})
            .attr("class", "season-control")
            .on("click", function(d) { d.func() } )
        return gEnter;
    }
    
    function getPlotDate(d) {
        var year = d.getMonth() > 8 ? epochYear : epochYear + 1;
        return (new Date(d)).setFullYear(year);
    }
    
    function getENSOvalue(d) {
        var ensoval;
        
        if (d.key == 'mean' || d.key == 'median') {
            ensoval = 'N/A';
        } else {
            ensoval = ensoIndex[d.key][0][ensoBin];
        }
        return ensoval
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
    
    function invertxpnt(xpnt) {
        var xval = xScale.invert(xpnt);
        xval = Math.floor(xval);
        
        xval = new Date(xval);
        //console.log(xval);
        
        var out = {}
        var year = xval.getFullYear();
        var waterYear = xval.getMonth() > 8 ? year + 1 : year;
        var waterYearStart = new Date(waterYear-1, 9, 1);
        
        out.waterDay = Math.round((xval - waterYearStart) / 86400000);
        out.date = xval
        
        return out;
    }
    
    // accessor methods
    chart.margin = function(_) {
        if (!arguments.length) return margin;
        margin = _;
        return chart;
    };

    chart.width = function(_) {
        if (!arguments.length) return width;
        width = _;
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
    
    chart.coolSeason = function() {
        xExtent = [tmin_cool, tmax_cool];
        yExtent = [ymin_cool, ymax_cool];
        console.log($(this));
        $(this).attr("stroke", "red");
        return chart.redraw();
    }
    
    chart.fullYear = function() {
        xExtent = [tmin_full, tmax_full];
        yExtent = [ymin_full, ymax_full];
        
        return chart.redraw();
    }
    
    chart.colorScale = function() {
        return colorScale;
    }
    
    chart.colorBins = function() {
        return colorBins;
    }
    
    chart.colorBinLabels = function() {
        return colorBinLabels;
    }
    
    chart.redraw = function() {
        containingSelection = d3.select(containingDivId);
        containingSelection.call(chart, [], true);
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
        
        var xdata = invertxpnt(point[0]);
        
        var yval = thisLineData.values[xdata.waterDay].cumulativePrecip;
        var yval = parseFloat(yval.toPrecision(3)) + " in";
        
        var ensoval = getENSOvalue(thisLineData);
                
        //var text = createTooltipText(thisLineData.key, String(yval), 'Day '+xdata.waterDay, 'MEI: '+ensoval, xdata.date);
        var text = createTooltipText(thisLineData.key, xdata.date, xdata.waterDay, String(yval), ensoval);
        
        var tooltip = d3.select(this.parentNode.parentNode.parentNode.parentNode).select(".tooltip");
        tooltip.html(text)
                .style("visibility", "visible");
    };
    
    chart.lineMousemove = function (d, i) {
        var thisLine = d3.select(this);
        var thisLineData = thisLine.data()[0];
        var point = d3.mouse(this);
        
        var xdata = invertxpnt(point[0]);
        
        var yval = thisLineData.values[xdata.waterDay].cumulativePrecip;
        var yval = parseFloat(yval.toPrecision(4)) + " in";
        
        var ensoval = getENSOvalue(thisLineData);
        
        var text = createTooltipText(thisLineData.key, xdata.date, xdata.waterDay, String(yval), ensoval);
        
        var tooltip = d3.select(this.parentNode.parentNode.parentNode.parentNode).select(".tooltip");

        var tooptipOffset = 5; // [jd:] was an offset of 10px - trying to improve offset
        tooltip.style("top", (event.clientY + tooptipOffset)+"px")
               .style("left", (event.clientX + tooptipOffset)+"px")
               .html(text);    
    };
    
    chart.lineMouseout = function (d, i) {
        setCursor("default");// [jd:] trying an improved UI
        var tooltip = d3.select(this.parentNode.parentNode.parentNode.parentNode).select(".tooltip");
        var thisSelection = d3.select(this)

        thisSelection.style("stroke-width", get_strokeWidthNormal);
        thisSelection.style("stroke-opacity", get_strokeOpacityNormal);

        tooltip.style("visibility", "hidden");
    };
    
    chart.buttonMouseover = function(d,i) {
        var thisSelection = d3.select(this);
        var labelText = labelMapping[thisSelection.attr("class")];
//         console.log("buttonMouseover: ", labelText);
        
        var tooltip = d3.select(containingDivId).select(".tooltip");
        var tooptipOffset = 5;
        tooltip.style("visibility", "visible")
               .style("top", (event.clientY + tooptipOffset)+"px")
               .style("left", (event.clientX + tooptipOffset)+"px")
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
//         console.log("buttonMouseout: ", labelText);
        
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

function createTooltipText(name, date, day, precip, enso) {
    // [jd:] move this logic to a function to only have to manipulate once
    sRet = '';
    sRet += '<div class="tooltip-name">' + name + "</div>";
    sRet += '<div class="tooltip-date">' + tooltipDateFormatter(date) + '</div>';
    sRet += '<div class="tooltip-date">' + 'Day ' + day + '</div>';
    sRet += '<div class="tooltip-value">' + precip + '</div>';
    sRet += '<div class="tooltip-value">' + 'MEI: ' + enso + '</div>';
    
    return sRet;
}

function setCursor(cursor) {
    d3.select("body").style("cursor", cursor);
}