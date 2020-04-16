
const express = require('express');
const app = express();
const upsAndDowns = require('./ups-and-downs_v2').upsAndDowns;

// // Initiate body parser to interprete post requests
const bodyParser = require('body-parser');
app.use(bodyParser.json());

// Set up Cross Origin Resource Sharing (CORS )
app.use( (req, res, next) => { 
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Headers","Origin, X-Request-With, Content-Type, Accept, Authorization");
  res.setHeader("Access-Control-Allow-Methods","GET, POST, PATCH, DELETE, OPTIONS");
  next();
});

// dont know why this isnt working when called from trailscape...
//
// app.use( (req, res, next) => {
//   // Check size of POST body - limit to MAX_DATA_POINTS number of rows
//   console.log(req.body);
//   if (req.body.coordsArray.length > MAX_DATA_POINTS) {
//     res.status(413).json( "POST request limit exceeded (limited to " + MAX_DATA_POINTS + " points)" );
//   } else {
//       next ();
//   }
// });

app.post('/ups-and-downs/', (req, res) => { 

  // check options array - if it's not present then fill it in with falses
  let options = req.body.options;
  if (!options) {
    options = {
      interpolate: false,
      writeResultsToFile: false
    }
  }

  // this is where the work gets done
  upsAndDowns(req.body.coordsArray, options).then( result => {
    res.status(200).json( {result} );
  })
  
});


module.exports = app;