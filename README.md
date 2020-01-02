# elevs-api
Node api to return elevations for given lng/lat coordinates using the NASA/METI ASTGTM003 dataset.
# Request Format
Form of request: http://server/elevations/ (where 'server' is the url of the hosted server)
# Post body format
The POST data body should take the form:
<p>
{ "options": <br>
&nbsp; &nbsp; {<br>
&nbsp; &nbsp; &nbsp; &nbsp; "interpolate": false,<br>
&nbsp; &nbsp; &nbsp; &nbsp; "writeResultsToFile": true <br>
&nbsp; &nbsp; },<br>
&nbsp; &nbsp; "coordsArray": <br>
&nbsp; &nbsp; &nbsp; &nbsp; [<br>
&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; {"lat":51.40462,"lng":-2.30217},<br>
&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; {"lat":51.4046,"lng":-2.30218},<br>
&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; {"lat":51.40459,"lng":-2.30219},<br>
&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; {"lat":51.40457,"lng":-2.3022}<br>
&nbsp; &nbsp; &nbsp; &nbsp;  ]<br>
&nbsp; &nbsp;}<br>
}
<p>
Where "options" is optional (options default to false).
<ul>
  <li>set interpolate = true if it is desired to interpolate (see note below)</li>
  <li>set writeResultsToFile = true if it is desired to save a datafile with the results ('./results/result.out')</li>
</ul>

# Results
<p>
{<br>
&nbsp; &nbsp;"result": [<br>
&nbsp; &nbsp; &nbsp; &nbsp;{<br>
&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; "lat": 51.40462,<br>
&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; "lng": -2.30217,<br>
&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; "elev": 31<br>
&nbsp; &nbsp; &nbsp; &nbsp;},<br>
&nbsp; &nbsp; &nbsp; &nbsp;{<br>
&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; "lat": 51.4046,<br>
&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; "lng": -2.30218,<br>
&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; "elev": 31<br>
&nbsp; &nbsp; &nbsp; &nbsp;},<br>
&nbsp; &nbsp; &nbsp; &nbsp;{<br>
&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; "lat": 51.40459,<br>
&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; "lng": -2.30219,<br>
&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; "elev": 31<br>
&nbsp; &nbsp; &nbsp; &nbsp;},<br>
&nbsp; &nbsp; &nbsp; &nbsp;{<br>
&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; "lat": 51.40457,<br>
&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; "lng": -2.3022,<br>
&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; "elev": 30<br>
&nbsp; &nbsp; &nbsp; &nbsp;}<br>
&nbsp; &nbsp;]<br>
}<br>
<p>

# Useful links
<ul>
  <li>https://lpdaac.usgs.gov/products/astgtmv003/</li>
  <li>https://lpdaac.usgs.gov/documents/434/ASTGTM_User_Guide_V3.pdf </li>
  <li>http://docs.opengeospatial.org/is/19-008r4/19-008r4.html#_pixelisarea_raster_space</li>
  <li>https://geotiffjs.github.io/geotiff.js/</li>
  <li>http://app.geotiff.io/</li>
  <li>https://www.get-metadata.com/</li>
</ul>
