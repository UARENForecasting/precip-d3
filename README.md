# precip-d3
Interactive plot of yearly cumulative precipitation in Tucson, colored by ENSO index.

The plot is made with [d3js](http://d3js.org).

Precipitation data comes from the [NCDC](http://www.ncdc.noaa.gov) daily summaries archive.

ENSO data comes from [ESRL](http://www.esrl.noaa.gov/psd/enso/mei/table.html).

We welcome comments and improvements. 
You should be able to clone this repo onto any web server, point your browser at the directory, and it should just work.
This project is MIT Licensed, so you can pretty much do whatever you want with it.
The most important exception is that you cannot use the UA logo unless you have obtained permission from UA.
See the license file for more information.

A brief guide to the repo:

* ``index.html`` is mostly header information, an empty div for the plot, and the text.
* ``js`` contains the javascript that does all of the work.
* ``js/scripts.js`` gets the data, parses the data, and passes the data to the plot function.
* ``js/graph.js`` contains the plot function.
* ``data`` contains several csv data files, though only one is currently used.
* ``colorbrewer`` contains nice color palettes.
* ``images`` has the static image of the plot and the UA logo.
* ``css`` has the css styling for the divs. There's a lot of unused stuff in this file.

This plot evolved from the [sveri.uaren.org](https://sveri.uaren.org) plots that Will Holmgren and UA CALS-CCT created in Spring of 2014.
