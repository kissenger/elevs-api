const express = require('express');
const app = express();
const bodyParser = require('body-parser');
// https://geotiffjs.github.io/geotiff.js/
const GeoTIFF = require('geotiff');

const DEBUG = true;


app.use(bodyParser.json());

app.post('/ts-elevs-api/', (req, res) => {
  // benchmark about 7 secs for 400 points
  console.log(timeStamp() + ': start');

  // print to console for debugging 

  const promises = req.body.coordsArray.map(point => getElevation(point, req.body.options));
  Promise.all(promises).then( (result) => {
    res.status(201).json( {result} );
    console.log(timeStamp() + ': end');
  });

});

/**
 * Return a filename in the form: ASTGTMV003_N36E025_dem.tif
 * @param {*} originLng longitude of the origin of the DEM tile (whole degree)
 * @param {*} originLat latitude of the origin of the DEM tile (whole degree)
 */
function getFileName(originLng, originLat) {

  fstr = "ASTGTMV003_"
  fstr += originLat < 0 ? "S" : "N";
  fstr += Math.abs(originLat).toString(10).padStart(2,'0');
  fstr += originLng < 0 ? "W" : "E";
  fstr += Math.abs(originLng).toString(10).padStart(3,'0');
  fstr += "_dem.tif"

  return fstr;

}


/**
 * Bilinear interpolation for elevation given 4 adjacent elevations
 * https://en.wikipedia.org/wiki/Bilinear_interpolation
 * Note that this works only for this application, the eqns have been simplified
 * @param {*} x0 defining position of poi as ratio of the width of the pixel
 * @param {*} y0 defining position of poi as ratio of the width of the pixel
 * @param {*} Q 2x2 matrix defining elevations in the 4 corners of the box
 */
function biLinearInterp(x0, y0, Q) {

  return ( Q[0][0] * (1 - x0) * (1 - y0) + 
           Q[1][0] * x0 * (1 - y0) +
           Q[0][1] * y0 * (1 - x0) +
           Q[1][1] * x0 * y0 );

}

/**
 * Determine the elevation at a point p
 * @param {*} p point as {lat: number, lng: number}
 */
function getElevation(p, opt) {

  const numberOfPixelsPerDegree = 3600;
  const pixelWidth = 1 / numberOfPixelsPerDegree;
  const offset = pixelWidth / 2;

  return new Promise( (res, rej) => {
    
    // calculate the origin of the dem tile, this will be the mid-point of the lower left pixel, in lng/lat
    // https://lpdaac.usgs.gov/documents/434/ASTGTM_User_Guide_V3.pdf
    const tileOriginLng = p.lng < 0 ? Math.trunc(p.lng - 1) : Math.trunc(p.lng);
    const tileOriginLat = p.lat < 0 ? Math.trunc(p.lat - 1) : Math.trunc(p.lat);

    // calculate the origin of the tif, being the upper left corner of the upper left pixel, in lng/lat
    // http://docs.opengeospatial.org/is/19-008r4/19-008r4.html#_pixelisarea_raster_space
    const tiffOriginLng = tileOriginLng - offset;     
    const tiffOriginLat = tileOriginLat + 1 + offset;

    // determine the lng/lat offsets of the point of interest from the tiff origin
    // offset the values by 'offset' (half pixel width) to ensure we find the upper left
    // pixel of the group of 4 boxes that will be interpolated over
    let dLng = p.lng - tiffOriginLng;
    let dLat = tiffOriginLat - p.lat;

    if (opt.interp) {
      dLng = dLng - offset;
      dLat = dLat - offset;
    }

    // convert to pixel x and y coordinates
    // this is the coordinate of the upper left pixel in the group of four 
    const pixelX = Math.trunc(dLng/pixelWidth);
    const pixelY = Math.trunc(dLat/pixelWidth);

    // now need to find where the poi is in the box of 4 pixels, relative to a line through their centres
    const boxOriginX = pixelX * pixelWidth + tileOriginLng;
    const boxOriginY = 1 - pixelY * pixelWidth + tileOriginLat;
    const x0 = (p.lng - boxOriginX) / pixelWidth;
    const y0 = (p.lat - boxOriginY) / pixelWidth;

    // load the geoTif tile into memory
    const fileName = getFileName(tileOriginLng, tileOriginLat);
    GeoTIFF.fromFile('./tiff/' + fileName).then( (tiff) => {
      tiff.getImage().then( (image) => {

        const shift = opt.interp ? 2 : 1;
        let info = {};
        image.readRasters({ window: [pixelX, pixelY, pixelX + shift, pixelY + shift] }).then( (result) => {

          if (opt.interp) {
            var elevs = [ [result[0][0], result[0][1] ], [ result[0][2], result[0][3] ] ];
            result = {
              ...p,
              "elev": biLinearInterp(x0, y0, pixelWidth, elevs) };
          } else {
            var elevs = "n/a"
            result = {
              ...p,
              "elev": result[0][0]
            }
          }

          if (opt.verbose) {
            info = {
              "interpolate": opt.interp,
              "raw": elevs,
              "bbox": image.getBoundingBox(),
              "pixels": [pixelX, pixelY, pixelX + shift-1, pixelY + shift-1] }
          };
          
          
          // console.log(elev);
          // console.log(p);
          // console.log(fileName);
          // console.log(pixelX, pixelY);
          // console.log(image.getBoundingBox());

          res({...result, ...info});
                  
        });
      });      
    });
  })
}

/**
 * Generates a readble timestamp for debugging/optimisation
 */
function timeStamp() {

  var now = new Date();
  var ms = String(now.getMilliseconds()).padStart(2,'0')
  var s = String(now.getSeconds()).padStart(2,'0')
  var m = String(now.getMinutes()).padStart(2,'0')
  var h = String(now.getHours()).padStart(2,'0')
  var dd = String(now.getDate()).padStart(2, '0');
  var mm = String(now.getMonth() + 1).padStart(2, '0'); //January is 0!
  var yyyy = now.getFullYear();

  return dd+'/'+mm+'/'+yyyy+' '+h+':'+m+':'+s+':'+ms;

}

module.exports = app;