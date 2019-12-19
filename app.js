const express = require('express');
const app = express();
const bodyParser = require('body-parser');

// https://geotiffjs.github.io/geotiff.js/
const GeoTIFF = require('geotiff');
const DEBUG = true;




// Set up Cross Origin Resource Sharing (CORS )
// app.use( (req, res, next) => {
//     // inject a header into the response
//     res.setHeader("Access-Control-Allow-Origin","*");
//     res.setHeader("Access-Control-Allow-Headers","Origin, X-Request-With, Content-Type, Accept, Authorization");
//     res.setHeader("Access-Control-Allow-Methods","GET, POST, PATCH, DELETE, OPTIONS");
  
//     next();
//   });

app.use(bodyParser.json());

app.post('/ts-elevs-api/', (req, res) => {

    
    // print to console for debugging 
    if (DEBUG) { console.log(' >> ts-elevation-api > POST'); }
  
    // get body content
    // console.log(req.body);
    var result = [];
    const coords = req.body.coordsArray;
    const numberOfPixelsPerDegree = 3600;
    const pixelWidth = 1/numberOfPixelsPerDegree;
    const offset = pixelWidth/2;

    for (let i = 0, imax = coords.length; i < imax; i++) {

        const point = coords[i];

        // calculate the origin of the dem tile, being the mid-point of the lower left pixel, in lng/lat
        // https://lpdaac.usgs.gov/documents/434/ASTGTM_User_Guide_V3.pdf
        const tileOriginLng = point.lng < 0 ? Math.trunc(point.lng - 1) : Math.trunc(point.lng);
        const tileOriginLat = point.lat < 0 ? Math.trunc(point.lat - 1) : Math.trunc(point.lat);

        // calculate the origin of the tif, being the upper left corner of the upper left pixel, in lng/lat
        // http://docs.opengeospatial.org/is/19-008r4/19-008r4.html#_pixelisarea_raster_space
        const tiffOriginLng = tileOriginLng - offset;
        const tiffOriginLat = tileOriginLat + 1 + offset;

        // determine the lng/lat offsets of the point of interest from the tiff origin
        const dLng = point.lng - tiffOriginLng;
        const dLat = tiffOriginLat - point.lat;

        // convert to pixel x and y coordinates
        const pixelX = Math.trunc(dLng/pixelWidth);
        const pixelY = Math.trunc(dLat/pixelWidth);
        
        // load the geoTif tile into memory
        const fileName = getFileName(tileOriginLng, tileOriginLat);
        GeoTIFF.fromFile('./tiff/' + fileName).then( (tiff) => {

            tiff.getImage().then( (image) => {

                image.readRasters({ window: [pixelX, pixelY, pixelX + 1, pixelY + 1] }).then( (value) => {
                    console.log('-------------');
                    console.log(point);
                    console.log(fileName);
                    console.log(value);
                    console.log(pixelX, pixelY);
                    console.log(image.getBoundingBox());
                });
            });
            
        });

        point.elev = 5;
        result.push(point);
    }



    res.status(201).json({helloWorld: result});
  });
  
  function getFileName(originLng, originLat) {
    // return a filename in the form: ASTGTMV003_N36E025_dem.tif
    
    fstr = "ASTGTMV003_"
    fstr += originLat < 0 ? "S" : "N";
    fstr += Math.abs(originLat).toString(10).padStart(2,'0');
    fstr += originLng < 0 ? "W" : "E";
    fstr += Math.abs(originLng).toString(10).padStart(3,'0');
    fstr += "_dem.tif"

    return fstr;
}

module.exports = app;