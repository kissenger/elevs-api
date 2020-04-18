# ups-and-downs API
Node api to return elevations for given lng/lat coordinates using the NASA/METI ASTGTM003 dataset.
Latest version v3 is a significant refactor and much improved performance.

# Dependencies
<ul>
  <li> <a href="https://geotiffjs.github.io/geotiff.js/">GeoTiff library</a> npm i geotiff </li>
</ul> 

# Request Format
Form of request: http://server/ups-and-downs/ (where 'server' is the url of the hosted server)

# Post body format
The POST data body should take the form:
<p>
 <pre>
{ "options": 
  {
    "interpolate": false,
    "writeResultsToFile": true
  },
  "coordsArray":
    [
      {"lat":51.40462,"lng":-2.30217},
      {"lat":51.4046,"lng":-2.30218},
      {"lat":51.40459,"lng":-2.30219},
      {"lat":51.40457,"lng":-2.3022}
   ]
  }
}
  </pre>
<p>
Where "options" is optional (options default to false).
<ul>
  <li>set <code>interpolate = true</code> if it is desired to interpolate (see note below) NOTE NOT YET SUPPORTED IN v3</li>
  <li>set <code>writeResultsToFile = true</code> if it is desired to save a datafile with the results ('./results/result.out')</li>
</ul>

# Results
<pre>
{
  "result": [
    {
      "lat": 51.40462,
      "lng": -2.30217,
      "elev": 31
    },
    {
      "lat": 51.4046,
      "lng": -2.30218,
      "elev": 31
    },
    {
       "lat": 51.40459,
       "lng": -2.30219,
       "elev": 31
     },
     {
       "lat": 51.40457,
       "lng": -2.3022,
       "elev": 30
     },
     {
       "lat": 51.40457,
       "lng": -2.3022,
       "elev": 30
     }
  ]
}
</pre>

# Useful links
<ul>
  <li>https://lpdaac.usgs.gov/products/astgtmv003/</li>
  <li>https://lpdaac.usgs.gov/documents/434/ASTGTM_User_Guide_V3.pdf </li>
  <li>http://docs.opengeospatial.org/is/19-008r4/19-008r4.html#_pixelisarea_raster_space</li>
  <li>https://geotiffjs.github.io/geotiff.js/</li>
  <li>http://app.geotiff.io/</li>
  <li>https://www.get-metadata.com/</li>
</ul>
