var d3 = require('d3');

/**
 * The
 * @param  {Object} configuration including filename and suites
 * @return {undefined}
 */
exports.run = function(config) {
  var filename = config.filename;
  var fileString = config.fileString;
  var suites = config.suites;
  var Renderer = config.renderer;
  var input = config.input;

  // user can optionally pass in rows and columnHeads already parsed
  // (i.e. from Tabletop)
  var rows = config.rows;
  var columnHeads = config.columnHeads;

  console.log("processing!", filename, suites)
  // we always test against the core suite
  var testSuites = [require('dataproofer-core-suite')]
  // if the user selected optional suites we require those
  suites.forEach(function(suite) {
    testSuites.push(require(suite))
  })

  if(!rows && fileString) {
    // Parse the csv with d3
    rows = d3.csv.parse(fileString);
  }
  if(!columnHeads || !columnHeads.length) {
    // TODO: we may want to turn this into an array
    columnHeads = Object.keys(rows[0])
  }

  // Initialize the renderer
  var renderer = new Renderer({
    filename: filename,
    suites: testSuites,
    fileString: fileString,
    columnHeads: columnHeads,
    rows: rows
  });

  var badColumnHeads = (function(rows, columnHeads) {
    console.log("checking column headers", columnHeads.length);
    var badHeaderCount = 0;
    var badColumnHeads = [];
    var htmlTemplate;
    var consoleMessage;
    var passed;

    var columnHeadCounts = _.reduce(columnHeads, function(counts, columnHead) {
      if (counts[columnHead]) {
        badColumnHeads.push(columnHead);
        badHeaderCount += 1;
      } else {
        counts[columnHead] = 0;
      }
      return counts;
    }, {});

    if (badHeaderCount > 0) {
      passed = false
      columnOrcolumnHeads = badHeaderCount > 1 ? "columnHeads" : "column";
      consoleMessage = "We found " + badHeaderCount + " " + columnOrcolumnHeads + " without a header"
      htmlTemplate = _.template(`
        We found <span class="test-value"><%= badHeaderCount  %></span> <%= columnOrcolumnHeads %> a missing header, which means you'd need to take guesses about the present data or you should provide it with a unique, descriptive name.
      `)({
        'badHeaderCount': badHeaderCount,
        'columnOrcolumnHeads': columnOrcolumnHeads
      });
    } else if (badHeaderCount === 0) {
      passed = true
      consoleMessage = "No anomolies detected";
    } else {
      passed = false
      consoleMessage = "We had problems reading your column headers"
    }

    var result = {
      passed: passed,
      title: "Missing or Duplicate Column Headers",
      consoleMessage: consoleMessage,
      htmlTemplate: htmlTemplate
    }

    renderer.addResult('dataproofer-core-suite', 'Missing or Duplicate Column Headers', result)
    return badColumnHeads;
  })(rows, columnHeads);


  var cleanedcolumnHeads = _.without(columnHeads, badColumnHeads.join(', '));
  console.log('\trows', rows);
  var cleanedRows = rows

  // TODO: use async series? can run suites in series for better UX?
  testSuites.forEach(function(suite) {
    // TODO: use async module to run asynchronously?
    suite.tests.forEach(function(test) {
      try {
        // run the test!
        var result = test(cleanedRows, cleanedcolumnHeads, input)
        // incrementally report as tests run
        renderer.addResult(suite.name, test.name, result);
      } catch(e) {
        // uh oh! report an error (different from failing a test)
        renderer.addError(suite.name, test.name, e);
      }
    })
  })
  renderer.done();
}
