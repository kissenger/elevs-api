
var chai = require("chai");
var expect = require('chai').expect;
var chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);

const upsAndDownsV2 = require('./ups-and-downs_v2').upsAndDowns;
const upsAndDownsV3 = require('./ups-and-downs_v3').upsAndDowns;
const fs = require('fs');
const BASE_DIR = './test-data/';
const options = {
  interpolate: false,
  writeResultsToFile: false
};


// Define the list of tests to run, in this case an array of objects, each object listing the 
// filenames containing the test data to load
const testList = [
    { inputData: 'test-1.inp', resultData: 'test-1-elevs-from-io.out'},
    { inputData: 'test-2.inp', resultData: 'test-2-elevs-from-io.out'},
    { inputData: 'test-3.inp', resultData: 'test-3-elevs-from-io.out'}
]


// Main test loop, the surrounding it is a hack to get the looping structure with promises working
// otherwise the 'before' does not deliver the promisified data
it('shoud equal 1', function () { 

  let testWithData = function (t) {
    // this is a closure to define the actual tests - needed to cope with a loop of tests each with promises
    
    return function () {

      // Do this on each loop before running the tests
      before( function() {
        this.timeout(30000);

        // load the requested data files for the current test
        return getTestData(t).then( function(data) {

          // run API versions and wait until all have run
          const promises = [
            upsAndDownsV2(data.inputData.coordsArray, options),
            upsAndDownsV3(data.inputData.coordsArray, options)
          ];
          return Promise.all(promises).then( function(results) {
            upsAndDownsOutputV2 = results[0].result;
            //.map( point => point.elev);
            upsAndDownsOutputV3 = results[1];
            const output = upsAndDownsOutputV2.map( (point, index) => ({...point, elevV3: upsAndDownsOutputV3[index].elev}));
            exportData('results.out', output);
            //.map( point => point.elev);
            // console.log(upsAndDownsOutputV2, upsAndDownsOutputV3);
          })

        });
      });

      // Tests
      it('should have arrays of the same length', function() {
        expect(upsAndDownsOutputV2.length).to.equal(upsAndDownsOutputV3.length);
      });

      it('should have arrays with matching elements', function() {
        expect(upsAndDownsOutputV2).to.have.deep.members(upsAndDownsOutputV3);
      });

    };
  }; 

  // This is where the actual looping occurs
  testList.forEach( function(test, index) {
    describe("Running Test " + (index + 1), testWithData(test));
  });

}) // it (hack)


// -------------------------------------------------------------------
// Loop through provided files in object, load and return the data
// Filenames provided in the formm {fileDescription: 'filename', fileDescription, 'fileName'}
// Return objeect replaces the filename with the data from the file
// Then, we keep association between the file purpose and the data
// -------------------------------------------------------------------
function getTestData(fileNames) {
  return new Promise( (res, rej) => {
    const promises = [];
    for ( const key in fileNames) {
      promises.push(importFromFile( {[key]: fileNames[key]} ));
    }
    Promise.all(promises).then( (values) => res(values.reduce( (out, ele) => ({...out, ...ele}), {} )) );
  });
}

// -------------------------------------------------------------------
// Load data from a provided filename
// File name is provided in the form {key: 'filename'}
// Result is provided in the form {key: data}
// This way the key  information is not lost so we can track the intended use of each file
// -------------------------------------------------------------------
function importFromFile(fileKeyValuePair) {
  return new Promise ( (rs, rj) => {
    const key = Object.keys(fileKeyValuePair)[0];
    const fn = fileKeyValuePair[key];
    fs.readFile(BASE_DIR + fn, (err, data) => {
      rs({[key]: JSON.parse(data)});
    });
  })
}

// -------------------------------------------------------------------
// Write data to file for further investigation
// -------------------------------------------------------------------
function exportData(fname, data) {
  // console.log(data);
  JSON.stringify(data)
  fs.writeFile(BASE_DIR + fname, JSON.stringify(data), (err) => {});
}