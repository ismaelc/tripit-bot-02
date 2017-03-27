var OAuth = require('oauth').OAuth;
var db = require('./documentdb.js');

var TRIPIT_API_KEY = "617fdb56c4883524621c3a8e0f08dfde20d74a31"
var TRIPIT_API_SECRET = "ce9e3924f25d8124300c6be093e73213a57ec1ce";

var tripit_oauth = new OAuth(
    "https://api.tripit.com/oauth/request_token",
    "https://api.tripit.com/oauth/access_token",
    TRIPIT_API_KEY,
    TRIPIT_API_SECRET,
    "1.0",
    null,
    "HMAC-SHA1"
);

/*
getTrip('f2b424e252913d3b79cd2aa752b6cffa386d2e75','41ba34a9b90a53b9ccc4b7c46c4dbb5f3b6b781a','190219167')
.then((trip) => console.log(JSON.parse(trip).Trip))
.catch((error) => console.log(error));
*/

/*
getCreds('U050C6MM6:T050C0DQU','ismaelc','slack','https://slack.botframework.com')
.then((credArr) => console.log('Cred: ' + JSON.stringify(credArr[0])))
.catch((error) => console.log(error))
*/

function getCreds(id, name, channelId, serviceUrl) {
    return new Promise((resolve, reject) => {
        db.getDatabase()
            // Get/create collection
            .then(() => db.getCollection())
            .then(() => {
                return db.getTripItCredsFromUserIdName(
                    id,
                    name,
                    channelId,
                    serviceUrl
                );
            })
            .then((credArr) => {
                resolve(credArr)
            })
            .catch((error) => {
                reject(error)
            })
    });
}

function getTrip(token, tokenSecret, id) {
    return new Promise((resolve, reject) => {
        tripit_oauth.get(
            //'https://api.tripit.com/v1/list/trip?format=json', // try trips for testing only
            'https://api.tripit.com/v1/get/trip/id/' + id + '/format/json',
            token, //test user token
            tokenSecret, //test user secret
            (e, data, _res) => {
                if (e) reject(e);
                else resolve(data);
            }
        )
    });
}

function listTrips(token, tokenSecret) {
    return new Promise((resolve, reject) => {
        tripit_oauth.get(
            //'https://api.tripit.com/v1/list/trip?format=json', // try trips for testing only
            //'https://api.tripit.com/v1/get/trip/id/' + id + '/format/json',
            'https://api.tripit.com/v1/list/trip/past/false/format/json',
            token, //test user token
            tokenSecret, //test user secret
            (e, data, _res) => {
                if (e) reject(e);
                else resolve(data);
            }
        )
    });
}

exports.getCreds = getCreds;
exports.getTrip = getTrip;
exports.listTrips = listTrips;
