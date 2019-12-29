const express = require('express');
const app = express();
const GeoTIFF = require('geotiff');             // https://geotiffjs.github.io/geotiff.js/
const bodyParser = require('body-parser');
app.use(bodyParser.json());

// define global variables 
// TODO: find a way to manage without global variables
let cache = {};
let database = {};

app.post('/ts-elevs-api/', (req, res) => {

  // reset cache and db
  cache = {};     // stores retrieved images
  database = {};  // stores elevations for retrieved pixels
  
  // promise chain running each point sequentially and returning the result as an array
  req.body.coordsArray.reduce( (promise, point) => {
    return promise.then( (allResults) => 
      getElevation(point).then( thisResult => 
        [...allResults, thisResult]
      ));
  }, Promise.resolve([])).then( result => 
    res.status(200).json( {result} )
  );

});


/**
 * returns the elevation for desired lng/lat coordinate pair
 * @param {*} point desired point as [lng, lat]
 */

function getElevation(point) {

  return new Promise( (res, rej) => { 
    const pixel = getPixel(point);
    const id = pixel.px.toString() + pixel.py.toString() + pixel.fname; 

    // if elevation for the required pixel and image exist in the database, then return that
    if (id in database) { 
      res( {lat: point[1], lng: point[0], elev: database[id]} ) 
    
    // otherwise get the required elevation and store in the db in case needed in the future
    } else {
      getImage(pixel.fname).then( (image) => {
        readPixelValue(image, pixel.px, pixel.py).then( (elev) => {
          database[id] = elev;
          res({lat: point[1], lng: point[0], elev: elev});
        })
      })
    }
  })
}


/**
 * Return fileName and .tiff pixel coordinates for desired lng/lat coordinate pair
 * @param {*} p desired point as {lat: number, lng: number}
 */
function getPixel(p) {

  // const numberOfPixelsPerDegree = 3600;
  // const pixelWidth = 1 / 3600;
  const offset = 1 / 7200;
  
  // calculate the origin of the dem tile, this will be the mid-point of the lower left pixel, in lng/lat
  // https://lpdaac.usgs.gov/documents/434/ASTGTM_User_Guide_V3.pdf
  const tileOriginLng = p[0] < 0 ? (p[0] - 1) << 0 : p[0] << 0;
  const tileOriginLat = p[1] < 0 ? (p[1] - 1) << 0 : p[1] << 0;

  // calculate the origin of the tif, being the upper left corner of the upper left pixel, in lng/lat
  // http://docs.opengeospatial.org/is/19-008r4/19-008r4.html#_pixelisarea_raster_space
  const tiffOriginLng = tileOriginLng - (offset);     
  const tiffOriginLat = tileOriginLat + 1 + offset;

  // determine the lng/lat offsets of the point of interest from the tiff origin
  // offset the values by 'offset' (half pixel width) to ensure we find the upper left
  // pixel of the group of 4 boxes that will be interpolated over
  const dLng = p[0] - tiffOriginLng;
  const dLat = tiffOriginLat - p[1];

  // if (opt.interp) {
  //   dLng = dLng - offset;
  //   dLat = dLat - offset; 
  // }

  // convert to pixel x and y coordinates
  // this is the coordinate of the upper left pixel in the group of four 
  const px = dLng * 3600 << 0;
  const py = dLat * 3600 << 0;

  // now need to find where the poi is in the box of 4 pixels, relative to a line through their centres
  // const boxOriginX = pixelX * pixelWidth + tileOriginLng;
  // const boxOriginY = 1 - pixelY * pixelWidth + tileOriginLat;
  // const x0 = (p.lng - boxOriginX) / pixelWidth;
  // const y0 = (p.lat - boxOriginY) / pixelWidth;

  const fname = getFileName(tileOriginLng, tileOriginLat);
  
  return {px, py, fname}

}


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
 * returns a GeoTiff image object, first checking cache - if it exists in cache then recall it, otherwise 
 * open from the desired file
 * @param {*} fn filename of desired image
 */
function getImage(fn) {

  return new Promise( (rs, rj) => {

    // if image is in the cache, the return this image
    if (fn in cache) { 
      rs(cache[fn]);

    // otherwise, load a new image from file (and store it in the cache)
    } else {
      GeoTIFF.fromFile('./tiff/' + fn).then( (tiff) => {
        tiff.getImage().then( (img) => {
          cache[fn] = img;
          rs(img);
        })
      });
    }
  })
}


/**
 * Returns the int16 value of the pixel defined at position (px, py) for tiff image img
 * @param {*} img GeoTIFF image object of the desired tile
 * @param {*} x pixel x coordinate in tifff corrdinate frame
 * @param {*} y pixel y coordinate in tifff corrdinate frame
 */

function readPixelValue(img, x, y) {

  return new Promise((rs, rj) => {
    const shift = 1;
    img.readRasters({ window: [x, y, x + shift, y + shift] }).then( (result) => { 
      rs(result[0][0]) 
    });
  })

}


/**
 * Bilinear interpolation for elevation given 4 adjacent elevations
 * https://en.wikipedia.org/wiki/Bilinear_interpolation
 * Note that this works only for this application, the eqns have been simplified
 * @param {*} x0 defining position of poi as ratio of the width of the pixel
 * @param {*} y0 defining position of poi as ratio of the width of the pixel
 * @param {*} Q 2x2 matrix defining elevations in the 4 corners of the box
 */
// function biLinearInterp(x0, y0, Q) {

//   return ( Q[0][0] * (1 - x0) * (1 - y0) + 
//            Q[1][0] * x0 * (1 - y0) +
//            Q[0][1] * y0 * (1 - x0) +
//            Q[1][1] * x0 * y0 );

// }



module.exports = app;