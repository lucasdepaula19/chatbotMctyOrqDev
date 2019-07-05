const Q = require('q');

var NaturalLanguageUnderstandingV1 = require('watson-developer-cloud/natural-language-understanding/v1');

var naturalLanguageUnderstanding = new NaturalLanguageUnderstandingV1({
  version: process.env.nluVersion,
  url: process.env.nluURL,
  username: process.env.nluUsername,
  password: process.env.nluPasword
});


async function NLU(parameters) {
  var deferred = Q.defer();
  try {
    naturalLanguageUnderstanding.analyze(parameters, function (err, response) {
      if (err) {
        console.log('NLU has found the follow error:', err);
        deferred.resolve(null);
      }
      else
        deferred.resolve(response);
    });
    return deferred.promise;
  } catch (err) {
  }

}


module.exports = {

  analyze: async function (text) {

    var parameters = {
      'text': text,
      'language': 'pt',
      'features': {
        'entities': {
          'emotion': true,
          'sentiment': true,
          'limit': 2
        },
        'keywords': {
          'emotion': true,
          'sentiment': true,
          'limit': 2
        }
      }
    };

    return await NLU(parameters);
  }
};