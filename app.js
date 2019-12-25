const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const GeoTIFF = require('geotiff');  // https://geotiffjs.github.io/geotiff.js/

app.use(bodyParser.json());

app.post('/ts-elevs-api/', (req, res) => {

  // preprocess the request - returns an array containing {pixelX, pixelY, fileName} for each request point
  dataArray = preProcess(req.body.coordsArray);

  // with preprocessed data, get an array containing only the specific unique images required
  // this avoids loading the images more times than is necessary
  let fileNames = objArray.map(data => data.fileName);
  let uniqueFileNames = [...new Set(fileNames)];
  uniqueImages = loadImages(uniqueFileNames);

  // request elevations from the open images
  const promises = req.body.coordsArray.map(point => {
    let img = uniqueImages(uniqueFileNames.indexOf(point.fileName));
    getElevation(point.pixelX, point.pixelY, img);
  });
  
  Promise.all(promises).then( (result) => {
    res.status(201).json( {result} );
  });

});

/**
 * Returns an array containing image objects correcponding to the filenames provided in the argument
 * @param {*} fNames array of file names for which to return images 
 */
function loadImages(fNames) {
  
  return new Promise( (res, rej) => {

    const imgPromises = fNames.map( (file) => {
      return new Promise( (rs, rj) => {
        GeoTIFF.fromFile('./tiff/' + fileName).then( (tiff) => {
          tiff.getImage().then( (image) => {
            rs(image);
          });
        });        
      }); 
    });

    promise.all(imgPromises).then( (result) => {
      res(result);
    })
  });
}



/**
 * return an array of [coord, pixX, pixY, fileName]
 * @param {*} p point as {lat: number, lng: number}
 */
function preProcess(points) {

  return new Promise( (res, rej) => {

    const numberOfPixelsPerDegree = 3600;
    const pixelWidth = 1 / numberOfPixelsPerDegree;
    const offset = pixelWidth / 2;
    const data = [];

    points.forEach( (point) => {

      // calculate the origin of the dem tile, this will be the mid-point of the lower left pixel, in lng/lat
      // https://lpdaac.usgs.gov/documents/434/ASTGTM_User_Guide_V3.pdf
      const tileOriginLng = point.lng < 0 ? Math.trunc(p.lng - 1) : Math.trunc(p.lng);
      const tileOriginLat = point.lat < 0 ? Math.trunc(p.lat - 1) : Math.trunc(p.lat);

      // calculate the origin of the tif, being the upper left corner of the upper left pixel, in lng/lat
      // http://docs.opengeospatial.org/is/19-008r4/19-008r4.html#_pixelisarea_raster_space
      const tiffOriginLng = tileOriginLng - offset;     
      const tiffOriginLat = tileOriginLat + 1 + offset;

      // determine the lng/lat offsets of the point of interest from the tiff origin
      // offset the values by 'offset' (half pixel width) to ensure we find the upper left
      // pixel of the group of 4 boxes that will be interpolated over
      let dLng = options.interpolate ?  p.lng - tiffOriginLng - offset : p.lng - tiffOriginLng;
      let dLat = tiffOriginLat - p.lat;

      // convert to pixel x and y coordinates
      // this is the coordinate of the upper left pixel in the group of four 
      const pixelX = Math.trunc(dLng/pixelWidth);
      const pixelY = Math.trunc(dLat/pixelWidth);

      // now need to find where the poi is in the box of 4 pixels, relative to a line through their centres
      // const boxOriginX = pixelX * pixelWidth + tileOriginLng;
      // const boxOriginY = 1 - pixelY * pixelWidth + tileOriginLat;
      // const x0 = (p.lng - boxOriginX) / pixelWidth;
      // const y0 = (p.lat - boxOriginY) / pixelWidth;

      const fName = getFileName(tileOriginLng, tileOriginLat);
      data.push({pixelX: pixelX, pixelY: pixelY, fileName: fName});
      

    });

    res(data);
  
  });
}

function getElevation(pX, pY, image) {


  image.readRasters({ window: [pX, pY, pX + shift, pY + shift] }).then( (result) => {

    // if (opt.verbose) {
    //   info = {
    //     "interpolate": opt.interp,
    //     "raw": elevs,
    //     "bbox": image.getBoundingBox(),
    //     "pixels": [pX, pY, pX + shift-1, pY + shift-1] }
    // };
    
    // console.log(elev);
    // console.log(p);
    // console.log(fileName);
    // console.log(pixelX, pixelY);
    // console.log(image.getBoundingBox());

    res({...result});
            
  })     
}


// function loadImage(fName) {
//   return new Promise( (res, rej) => {
//     GeoTIFF.fromFile('./tiff/' + fileName).  then( (tiff) => {
//       tiff.getImage().then( (image) => {
//         return image
//       });
//     });
//   });
// }


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