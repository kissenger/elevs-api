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
    console.log(req.body);
    
    const coords = req.body.coordsArray;
    const result = [];
    for (let i = 0, imax = coords.length; i < imax; i++) {
        thisPoint = coords[i];

        // Determine the tile corresponding to the current lng/lat coordinate
        var tileCoords = "";
        if (thisPoint.lat < 0) {
            tileCoords += "S" + (- Math.trunc(thisPoint.lat + 1)).toString(10).padStart(2, '0');
        } else {
            tileCoords += "N" + (+ Math.trunc(thisPoint.lat + 0)).toString(10).padStart(2, '0');
        }        
        if (thisPoint.lng < 0) {
            tileCoords += "W" + (- Math.trunc(thisPoint.lng + 1)).toString(10).padStart(3, '0');
        } else {
            tileCoords += "E" + (+ Math.trunc(thisPoint.lng + 0)).toString(10).padStart(3, '0');
        }
        const tileName = "ASTGTMV003_" + tileCoords + "_dem.tif";
        
        console.log(tileName);

        GeoTIFF.fromFile('./tiff/' + tileName).then( (tiff) => {
            console.log("success??");

            tiff.getImage().then( (image) => {

                console.log(image.getWidth());
                console.log(image.getHeight());
                console.log(image.getTileWidth());
                console.log(image.getTileHeight());
                console.log(image.getSamplesPerPixel());
                console.log(image.getOrigin());
                console.log(image.getResolution());
                console.log(image.getBoundingBox());

                const left = 50;
                const top = 10;
                const right = 51;
                const bottom = 11;

                image.readRasters({ window: [left, top, right, bottom] }).then( (rgb) => {
                    console.log(rgb);
                });
            });
            
        });

        thisPoint.elev = 5;
        result.push(thisPoint);
    }



    res.status(201).json({helloWorld: result});
  });
  

module.exports = app;