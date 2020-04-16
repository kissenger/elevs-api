/**
 * upsAndDowns API v2
 * Gets elevations from ASTGTM_v3 data downloaded from https://lpdaac.usgs.gov/products/astgtmv003/ Dec 2019
 * Resolution is 1 arc second, which is 30m
 * For local dev run server using 'nodemon server.js'
 * ------------------------------------------------
 * Changes at v2
 * changes to the way imgs are stashed to avoid lookups in large arrays for long routes
 * rename readPixels() to readPixel() to better descibe its job
 * rename getImage() to getTiff() to distiguish from geotiff.js function of the same name
 */ 

// Global variables
// TODO: find a way to manage without global variables

// these only for debugging when requires
const writeResultsToFile = require('./utils.js').writeResultsToFile;

// const timeDiff = require('./utils').timeDiff;
// const timeStamp = require('./utils.js').timeStamp;
// const startTime = new Date();

const GeoTIFF = require('geotiff');             // https://geotiffjs.github.io/geotiff.js/
const pool = new GeoTIFF.Pool();
let CACHE = {
  pixels: {},
  images: {}
};
const TIFF_PATH = '../../__TIFF/';


/**
 * 
 * @param {*} points array of coordinates as [{lat: number, lng: number}, {lat: ...}, .... ]
 * @param {*} options options array
 */
function upsAndDowns(points, options) {
  // console.log({cacheSize: {pixels: Object.keys(CACHE.pixels).length, 
  //   images: Object.keys(CACHE.images).length}});

  // console.log(timeDiff(new Date() - startTime) + ' upsAndDowns');

  // ensure that the cache is empty
  CACHE.pixels = {};
  CACHE.images = {};

  return new Promise( (resolve, reject) => {

    // promise chain running each point sequentially and returning the result as an array
    points.reduce( (promise, point) => {
      return promise.then( (allResults) => 
        getElevation(point, options.interpolate).then( thisResult => 
          [...allResults, thisResult]
        ));
    }, Promise.resolve([])).then( result => {
      if (options.writeResultsToFile) { writeResultsToFile(result, options); } 
      // console.log(CACHE.pixels);
      // console.log(timeDiff(new Date() - startTime) + ' finished');
      resolve({
          result, 
          cacheSize: {pixels: Object.keys(CACHE.pixels).length, 
          images: Object.keys(CACHE.images).length}
        });
    });

  });

}

/**
 * returns the elevation for desired lng/lat coordinate pair
 * @param {*} point desired point as {lat: number, lng: number}
 */

function getElevation(point, booInterp) {

  // console.log(timeDiff(new Date() - startTime) + ' getElevation');

  return new Promise( (res, rej) => { 

    const pixel = getPixelPosition(point, booInterp);
    const id = pixel.px.toString() + pixel.py.toString() + pixel.fname; 
    // console.log(id);

      getTiff(pixel.fname).then( (image) => {
        readPixel(image, pixel.px, pixel.py, id, booInterp).then( (rawElevs) => {
          const elev = booInterp ? biLinearInterp( pixel.x0, pixel.y0, rawElevs[0]) : rawElevs[0][0];
          res({lat: point.lat, lng: point.lng, elev: Math.round(elev * 10)/10});
        })
      })
    // }
  })
}

/**
 * Return fileName and .tiff pixel coordinates for desired lng/lat coordinate pair
 * @param {*} p desired point as {lat: number, lng: number}
 * @param interp boolean: true if interpolation is required
 */
function getPixelPosition(p, interp) {

  // console.log(timeDiff(new Date() - startTime) + ' getPixelPosition');

  const numberOfPixelsPerDegree = 3600;
  const pixelWidth = 1 / numberOfPixelsPerDegree;
  const offset = pixelWidth / 2;
  
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

  if (interp) {
    dLng = dLng - offset;
    dLat = dLat - offset; 
  }

  // convert to pixel x and y coordinates
  // this is the coordinate of the upper left pixel in the group of four 
  const px = Math.trunc(dLng/pixelWidth);
  const py = Math.trunc(dLat/pixelWidth);

  // get the filename for corresponding tile
  const fname = getFileName(tileOriginLng, tileOriginLat);
  let result = {px, py, fname}

  // now need to find where the poi is in the box of 4 pixels, relative to a line through their centres
  if (interp) {
    const boxOriginX = px * pixelWidth + tileOriginLng;
    const boxOriginY = 1 - py * pixelWidth + tileOriginLat;
    const x0 = (p.lng - boxOriginX) / pixelWidth;
    const y0 = (boxOriginY- p.lat) / pixelWidth;
    result = {...result, x0, y0}
  }

  return result

}


/**
 * Return a filename in the form: ASTGTMV003_N36E025_dem.tif
 * @param {*} originLng longitude of the origin of the DEM tile (whole degree)
 * @param {*} originLat latitude of the origin of the DEM tile (whole degree)
 */
function getFileName(originLng, originLat) {

  // console.log(timeDiff(new Date() - startTime) + ' getFileName');

  fstr = "ASTGTMV003_"
  fstr += originLat < 0 ? "S" : "N";
  fstr += Math.abs(originLat).toString(10).padStart(2,'0');
  fstr += originLng < 0 ? "W" : "E";
  fstr += Math.abs(originLng).toString(10).padStart(3,'0');
  fstr += "_dem.tif"

  return fstr;

}


/**
 * returns a GeoTiff image object, first checking CACHE - if it exists in CACHE then recall it, otherwise 
 * open from the desired file
 * @param {*} fn filename of desired image
 */
function getTiff(fn) {

  // console.log(timeDiff(new Date() - startTime) + ' getImage');

  return new Promise( (rs, rj) => {

    // if image is in the CACHE, the return this image
    if (fn in CACHE.images) { 
      rs( CACHE.images[fn] );

    // otherwise, load a new image from file (and store it in the CACHE)
    } else {
      GeoTIFF.fromFile(TIFF_PATH + fn).then( (tiff) => {
        tiff.getImage().then( (img) => {
          CACHE.images[fn] = img;
          // console.log(timeDiff(new Date() - startTime) + ' finished getImage');
          rs(img);
        })
      });
    }
  })
}



// /**
//  * Returns the int16 value of the pixel defined at position (px, py) for tiff image img
//  * @param {*} img GeoTIFF image object of the desired tile
//  * @param {*} px pixel px coordinate in tiff coordinate frame
//  * @param {*} py pixel py coordinate in tiff coordinate frame
//  */
// function readPixelValue(img, px, py) {

//   return new Promise( (rs, rj) => {

    
//     const shift = 1;
//     img.readRasters({ window: [px, py, px + shift, py + shift] }).then( (result) => { 
//       rs(result[0][0]) 
//     });
//   })

// }

/**
 * Returns the int16 value of the pixel defined at position (px, py) for tiff image img
 * @param {*} img GeoTIFF image object of the desired tile
 * @param {*} px pixel px coordinate in tifff corrdinate frame
 * @param {*} py pixel py coordinate in tifff corrdinate frame
 * @param {*} id unique id for pixel and image
 * @param {*} boo boolean flag indicating whether interpolation is required
 */
function readPixel(img, px, py, id, boo) {

  // console.log(timeDiff(new Date() - startTime) + ' readPixels');

  return new Promise( (rs, rj) => {

    // check if we have the required data in the CACHE already; if not load it
    if (id in CACHE.pixels) { 
      promise = Promise.resolve( CACHE.pixels[id] )
    } else {
      const shift = boo ? 2 : 1;
      // console.log('here');
      promise = img.readRasters({ pool, window: [px, py, px + shift, py + shift] });
      // console.log(promise);
    }

    // when thats done, save result to CACHE and return result
    promise.then( (result) => {
      // console.log('there');
      CACHE.pixels[id] = result;
      rs(result); 
    })

  })

}


/**
 * Bilinear interpolation for elevation given 4 adjacent elevations
 * https://en.wikipedia.org/wiki/Bilinear_interpolation
 * Note that this works only for this application, the eqns have been simplified
 * @param {*} x0 defining x position of poi as ratio of the width of the pixel
 * @param {*} y0 defining y position of poi as ratio of the width of the pixel
 *               NOTE that the origin of the box is the upper left corner
 * @param {*} Q 4x1 matrix defining elevations in the 4 corners of the box 
 *             (in the order: [top-left, top-right, bottom-left, bottom-right] )
 * pixels are ordered top-left, top-right, bottom-left, bottom-right
 * Q11 = bottom left = top left = Q[0]
 * Q21 = bottom right = top right = Q[1]
 * Q12 = top left = bottom left = Q[2]
 * Q22 = top right = bottom right = Q[3]
 */
function biLinearInterp(x0, y0, Q) {
  // console.log(x0, y0, Q);

  return ( Q[0] * (1 - x0) * (1 - y0) + 
           Q[1] * x0 * (1 - y0) +
           Q[2] * y0 * (1 - x0) +
           Q[3] * x0 * y0 );

}

module.exports = {
  upsAndDowns 
};