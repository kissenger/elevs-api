/**
 * upsAndDowns
 * Gets elevations from ASTGTM_v3 data downloaded from https://lpdaac.usgs.gov/products/astgtmv003/ Dec 2019
 * Resolution is 1 arc second, which is 30m
 * For local dev run server using 'nodemon server.js'
 * ------------------------------------------------
 * Changes at v2
 * changes to the way imgs are stashed to avoid lookups in large arrays for long routes
 * rename readPixels() to readPixel() to better descibe its job
 * rename getImage() to getTiff() to distiguish from geotiff.js function of the same name
 * ------------------------------------------------
 * Changes at v3
 * almost complete re-factor with new strategy
 * options argument removed, bilin interp function removed (still in v2 if needed)
 */ 

const TIFF_PATH = '../../__TIFF/';
const GeoTIFF = require('geotiff');             // https://geotiffjs.github.io/geotiff.js/
// const pool = new GeoTIFF.Pool();

/**
 * 
 * @param {*} points array of coordinates as [{lat: number, lng: number}, {lat: ...}, .... ]
 */
function upsAndDowns(points) {

  return new Promise( (resolve, reject) => {
    const imageMap = preProcessPoints(points);
    getElevations(points, imageMap).then( (results) => {
      resolve(results) 
    });
    
  });

}

/**
 * The function of the pre-process is to:
 *  1) Understand which images we will need to read
 *  2) Create a unique list of pixels to read from each image
 *  3) Keep track of which points each pixel will supply an elevation for
 *  4) Understand the pixel bounding box to read for each image
 * It does this with the help of the ImageAssociation class
 */
function preProcessPoints(points) {

  const images = [];
  points.forEach( (point, index) => {

    const pix = getPixelPosition(point);
    const imgIndex = images.map(img => img.fname).indexOf(pix.fname);
    if (imgIndex < 0) {
      images.push(new ImageAssociation(pix, index));
    } else {
      images[imgIndex].addPixel(pix, index);
    };
  })

  return images;
}

/**
 * Class to keep track of pixels associated with each required image
 * and to improve abstraction in main code
 */
class ImageAssociation {

  constructor(pix, pointIndex) {
    this.fname = pix.fname;       // filename of the required image
    this.pixels = [{              // pixel coords and array of points that share this elevation
      px: pix.px, 
      py: pix.py, 
      points: [pointIndex]
    }]; 
    this.minMax = {               // x and y bounding box for this image
      minX: pix.px, 
      minY: pix.py, 
      maxX: pix.px, 
      maxY: pix.py };
  }

  // return an array defining min x and y, and shift in x and y (format required by readRasters())
  getWindow() {
    return [ this.minMax.minX, this.minMax.minY, this.minMax.maxX + 1, this.minMax.maxY + 1];
  }

  getWindowWidth() {
    return this.minMax.maxX + 1 - this.minMax.minX;
  }

  // add a pixel to the instance
  addPixel(pxy, pointIndex) {
    
    const loc = this.pixels.map( pxy => JSON.stringify([pxy.px, pxy.py])).indexOf(JSON.stringify([pxy.px, pxy.py]));
    if ( loc >= 0 ) {   // pixel exists, so just add the index to the supplied pixel
      this.pixels[loc].points.push(pointIndex)

    } else {            // pixel does not exist, so add it to the instance
      this.pixels.push({px: pxy.px, py: pxy.py, points: [pointIndex]});
      this.minMax.minX = this.minMax.minX > pxy.px ? pxy.px : this.minMax.minX;
      this.minMax.minY = this.minMax.minY > pxy.py ? pxy.py : this.minMax.minY;
      this.minMax.maxX = this.minMax.maxX < pxy.px ? pxy.px : this.minMax.maxX;
      this.minMax.maxY = this.minMax.maxY < pxy.py ? pxy.py : this.minMax.maxY;
    }
  }

}

/**
 * Returns an array of points with elevations, given the original points list and associations
 * New at v3
 * @param {*} points array of points as coordinate pairs [{lat: yy, lng: xx}, {...} ]
 * @param {*} imageAssocArr array of ImageAssociation instances (created in pre-process function)
 */
function getElevations(points, imageAssocArr) {

  return new Promise( (res, rej) => { 
    const newPoints = points.slice();
    promises = imageAssocArr.map( (imgAssoc) => {
      
      return new Promise( (rs, rj) => { 
        const window = imgAssoc.getWindow();
        const windowWidth = imgAssoc.getWindowWidth();
        getDataFromImage( imgAssoc.fname, window).then( raster => {

          // for each pixel associated with the image, calculate the elevation and add to all points
          // associated with the same pixel
          imgAssoc.pixels.forEach( pixel => {
            const x = pixel.px - window[0];
            const y = pixel.py - window[1];
            const elev = raster[x + y * windowWidth];
            pixel.points.forEach( point => newPoints[point].elev = elev );
          });

          rs();  // resolve the mapped promise once all points on img have been processed

        });   // getDataFromImage()
      })
      
    })  //map

    Promise.all(promises).then( () => res(newPoints) );
  });
    
}

/**
 * Return fileName and .tiff pixel coordinates for desired lng/lat coordinate pair
 * Unchanged at v3
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

  // convert to pixel x and y coordinates
  // this is the coordinate of the upper left pixel in the group of four 
  const px = Math.trunc(dLng/pixelWidth);
  const py = Math.trunc(dLat/pixelWidth);

  // get the filename for corresponding tile
  let result = {px, py, fname: getFileName(tileOriginLng, tileOriginLat)};

  return result;

}


/**
 * Return a filename in the form: ASTGTMV003_N36E025_dem.tif
 * Unchanged at v3
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
 * Given the filename of the desired image, loads it, read it and returns the raster array
 * Updates at v3: now reads the image and retruns the raster, rather than just loading the img
 * @param {*} fn filename of desired image
 */
function getDataFromImage(fn, w) {
  return new Promise( (rs, rj) => {
    GeoTIFF.fromFile(TIFF_PATH + fn).then( (tiff) => {
      tiff.getImage().then( (img) => {
        // img.readRasters({pool, window: w}).then( raster => {
        img.readRasters({window: w}).then( raster => {
          rs(raster[0]);
        })
      })
    });
  })
}

module.exports = {
  upsAndDowns 
};