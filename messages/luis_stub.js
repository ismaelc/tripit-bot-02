var request = require('request');
//TODO: Move url as ENV 
var model = 'https://westus.api.cognitive.microsoft.com/luis/v2.0/apps/b0c6e3f0-b160-4b8b-83d1-060f85469721?subscription-key=c3b92446504d44eab832c686944145d6&verbose=true'; // + '&r=' + Math.random().toString(36).substring(7);

/*
getIntent('hmm', function(err, response) {
    console.log(response.topScoringIntent.intent);
});
*/

function getIntent(text, callback) {

    request(model + '&q=' + text, function(error, response, body) {
        if (!error && response.statusCode == 200) {
            //console.log(body) // Show the HTML for the Google homepage.
            callback(null, JSON.parse(response.body));
        }
        else callback(error, null);
    });
}

exports.getIntent = getIntent;
