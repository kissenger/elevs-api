const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const GeoTIFF = require('geotiff');  // https://geotiffjs.github.io/geotiff.js/

app.use(bodyParser.json());

app.post('/ts-elevs-api/', (req, res) => {

  // preprocess the request - works out for every point which file (tile) to request, and the specific pixel needed
  // returns an array containing {pixelX, pixelY, fileName} for each request point
  
  console.log(timeStamp() + ': start');
  
  preProcess(req.body.coordsArray).then(pre=> {
  // console.log(pre);
      
      const promises = pre.data.map( (point) => {
        return new Promise( (res, rej) => {
          if ( point.isPointAsLast ) { 
            res(-999); 
          } else { 
            // console.log(pre.fNames.indexOf(point.fileName));
            // console.log(pre.fNames);
            getElevation(point, pre.images[pre.fNames.indexOf(point.fileName)]).then( (elev) => {
              res(elev);
            })
          }

            
        })
      
      })

      Promise.all(promises).then( (result) => {        

        res.status(200).json(result);
        console.log(timeStamp() + ': end');
        // loop through requested points and find the elevation for the point

      });

    });
  
  });
// });

/**
 * Returns an array containing image objects correcponding to the filenames provided in the argument
 * @param {*} fNames array of file names for which to return images 
 */
function getImage(fn) {
  
  return new Promise( (rs, rj) => {
    GeoTIFF.fromFile('./tiff/' + fn).then( (tiff) => 
      tiff.getImage().then( (img) => rs(img) )
    );
  });
    
}

/**
 * return an array of [coord, pixX, pixY, fileName]
 * @param {*} p point as {lat: number, lng: number}
 */
function preProcess(points) {
  
  return new Promise( (res, rej) => {

    // prepare calculation parameters
    const numberOfPixelsPerDegree = 3600;
    const pixelWidth = 1 / numberOfPixelsPerDegree;
    const offset = pixelWidth / 2;
    const data = [];
    const fNames = [];
    let isImageAsLast = false;
    let isPointAsLast = false; 



    // loop through each point, determine which pixel is reqd from which image
    points.forEach( (point, ipoint) => {
    // preArray = points.map( (point, ipoint) => {

      // return new Promise( (resInner, rejInner) => {

        // calculate the origin of the dem tile, this will be the mid-point of the lower left pixel, in lng/lat
        // https://lpdaac.usgs.gov/documents/434/ASTGTM_User_Guide_V3.pdf
        const tileOriginLng = point.lng < 0 ? Math.trunc(point.lng - 1) : Math.trunc(point.lng);
        const tileOriginLat = point.lat < 0 ? Math.trunc(point.lat - 1) : Math.trunc(point.lat);

        // calculate the origin of the tif, being the upper left corner of the upper left pixel, in lng/lat
        // http://docs.opengeospatial.org/is/19-008r4/19-008r4.html#_pixelisarea_raster_space
        const tiffOriginLng = tileOriginLng - offset;     
        const tiffOriginLat = tileOriginLat + 1 + offset;

        // determine the lng/lat offsets of the point of interest from the tiff origin
        // offset the values by 'offset' (half pixel width) to ensure we find the upper left
        // pixel of the group of 4 boxes that will be interpolated over
        let dLng = point.lng - tiffOriginLng;
        let dLat = tiffOriginLat - point.lat;

        // convert to pixel x and y coordinates
        // this is the coordinate of the upper left pixel in the group of four 
        const pX = Math.trunc(dLng/pixelWidth);
        const pY = Math.trunc(dLat/pixelWidth);

        // now need to find where the poi is in the box of 4 pixels, relative to a line through their centres
        // const boxOriginX = pixelX * pixelWidth + tileOriginLng;
        // const boxOriginY = 1 - pixelY * pixelWidth + tileOriginLat;
        // const x0 = (p.lng - boxOriginX) / pixelWidth;
        // const y0 = (p.lat - boxOriginY) / pixelWidth;

        const fName = getFileName(tileOriginLng, tileOriginLat);
        const uniqueId = pX.toString() + pY.toString() + fName;
        if ( data.length !== 0 ) {
          isImageAsLast = fName === data[data.length - 1].fileName;
          isPointAsLast = uniqueId === data[data.length - 1].uniqueId;
        }
        if (!fNames.includes(fName)) { fNames.push(fName); }
 
        data.push( {
          lat: point.lat, 
          lng: point.lng, 
          pixelX: pX, 
          pixelY: pY, 
          fileName: fName,
          uniqueId, 
          isImageAsLast, 
          isPointAsLast
        } );

      // });
    });

    promises = fNames.map( fName => getImage(fName) );
    Promise.all(promises).then( (images) => {
      console.log(timeStamp() + ': pre finished');
      res( {data, fNames, images});
    });
  });
  // })
}

function getElevation(point, image) {

  return new Promise ( (res, rej) => {

    // console.log('10');
    // console.log(point);

    const shift = 1;
    image.readRasters({ window: [point.pixelX, point.pixelY, point.pixelX + shift, point.pixelY + shift] }).then( (result) => {
      res(result[0][0]);
    })
            
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