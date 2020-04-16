/**
 * export data to CSV
 * @param {} data
 */
function writeResultsToFile(data, opts) {

  const fs = require('fs');
  let file = fs.createWriteStream("./results/results.out");

  file.write(timeStamp() + '\n');
  file.write(JSON.stringify(opts) + '\n');
  data.forEach( (line) => {
    file.write([line.lng, line.lat, line.elev].join(',') + '\n')
  })

}

/**
 * Generates a readble timestamp for debugging/optimisation
 * Used when writing output file
 */
function timeDiff(ms) {

  // var msec = diff;
  const hh = Math.floor(ms / 1000 / 60 / 60);
  ms -= hh * 1000 * 60 * 60;
  const mm = Math.floor(ms / 1000 / 60);
  ms -= mm * 1000 * 60;
  const ss = Math.floor(ms / 1000);
  ms -= ss * 1000;

  return String(hh).padStart(2,'0')+':'+
         String(mm).padStart(2,'0')+':'+
         String(ss).padStart(2,'0')+':'+
         String(ms).padStart(3,'0');
}

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

module.exports = {
  writeResultsToFile,
  timeDiff
};