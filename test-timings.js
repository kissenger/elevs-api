const fs = require('fs');
const upsAndDowns = require('./ups-and-downs_v3').upsAndDowns;
const timeDiff = require('./utils').timeDiff;

/**
 * Loads array from selected file, then runs benchmarking tests for slices of different sizes
 * Outputs a table of the results
 * ** I dont think that the promises are waiting until the last one finishes, so there is some 
 * parallel processing going on - for a true picture need to run tests one at a time.
 */
getDataFromFile('./test-data/test-data-timings.txt').then( (data) => {
  
  options = {
    interpolate: false,
    writeResultsToFile: false
  };

  // use tests to define the lengths of array to test
  // const tests = [10, 100, 250, 500, 1000, 1500, 2000, 2500, 3000];
  const tests = [250];
  const dataChunks = tests.map( test => data.slice(0,test));
  const startTime = new Date();

  dataChunks.reduce( (promise, data) => {
    return promise.then( (results) => 
      upsAndDowns(data, options).then( thisResult => 
        [...results, {
          // elevations: thisResult.result.map(r => r.elev),
          nPoints: data.length, 
          // nPixels: thisResult.cacheSize.pixels, 
          // nImages: thisResult.cacheSize.images, 
          time: timeDiff(new Date() - startTime)} ]
        // [...results, {}]
      ));
  }, Promise.resolve([])).then( result => {
    console.table(result);
    console.log('Tests finished in ' + timeDiff(new Date() - startTime));
  });

});

function getDataFromFile(fn) {
  // returns Path object created from gpx import stored in provided file
  return new Promise ( (res, rej) => {
    fs.readFile(fn, (err, data) => {
      res(JSON.parse(data));
    });
  })
}