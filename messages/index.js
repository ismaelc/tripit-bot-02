/*-----------------------------------------------------------------------------
This template gets you started with a simple dialog that echoes back what the user said.
To learn more please visit
https://docs.botframework.com/en-us/node/builder/overview/
-----------------------------------------------------------------------------*/
"use strict";
var builder = require("botbuilder");
var botbuilder_azure = require("botbuilder-azure");
var azure = require('azure-storage');
var luis = require('./luis_stub.js');
var utils = require('./utils.js');
//var db = require('./documentdb.js');
var tripit = require('./tripit.js');
var queue = require('./queue.js');

var useEmulator = (process.env.NODE_ENV == 'development');

var connector = useEmulator ? new builder.ChatConnector() : new botbuilder_azure.BotServiceConnector({
    appId: process.env['MicrosoftAppId'],
    appPassword: process.env['MicrosoftAppPassword'],
    stateEndpoint: process.env['BotStateEndpoint'],
    openIdMetadata: process.env['BotOpenIdMetadata']
});

var bot = new builder.UniversalBot(connector);
var tripit_auth_url = 'https://tripit-auth.azurewebsites.net/';

// Intercept trigger event (ActivityTypes.Trigger)
bot.on('trigger', function (message) {
    // handle message from trigger function
    var queuedMessage = message.value;
    var reply = new builder.Message()
        .address(queuedMessage.address)
        .text('This is coming from the trigger: ' + queuedMessage.text);
    bot.send(reply);
});

// Handle message from user
bot.dialog('/', function (session) {
    /*
    var queuedMessage = { address: session.message.address, text: session.message.text };
    // add message to queue
    session.sendTyping();
    var queueSvc = azure.createQueueService(process.env.AzureWebJobsStorage);
    queueSvc.createQueueIfNotExists('bot-queue', function(err, result, response){
        if(!err){
            // Add the message to the queue
            var queueMessageBuffer = new Buffer(JSON.stringify(queuedMessage)).toString('base64');
            queueSvc.createMessage('bot-queue', queueMessageBuffer, function(err, result, response){
                if(!err){
                    // Message inserted
                    session.send('Your message (\'' + session.message.text + '\') has been added to a queue, and it will be sent back to you via a Function');
                } else {
                    // this should be a log for the dev, not a message to the user
                    session.send('There was an error inserting your message into queue');
                }
            });
        } else {
            // this should be a log for the dev, not a message to the user
            session.send('There was an error creating your queue');
        }
    });
    */

    if (session.message.address.conversation.hasOwnProperty('name') && (session.message.address.conversation.name != 'directmessage')) {
        // Is a group chat
        //session.send('Group address pushed: ' + JSON.stringify(utils.saveLastGroupChannelAddress(session)));
        var saved = utils.saveLastGroupChannelAddress(session);
        //session.send(JSON.stringify(saved));
        //session.send(JSON.stringify(session.message.address));
    }

    // Check if this is a 'conversation' and if tripit was mentioned
    // Ignore chat if it's in a channel/group and 'tripit' was NOT mentioned
    if ((session.message.address.conversation.hasOwnProperty('name')) && (session.message.text.toLowerCase().indexOf('tripit') == -1)) {
        //if ((typeof session.message.address.conversation.name !== 'undefined') && (session.message.text.toLowerCase().indexOf('tripit') == -1)) {
        //session.send('Match')
        //console.log('<Chat ignored>: ' + JSON.stringify(session.message.address.conversation));
        session.endDialog();
    } else {
        //console.log('Went here');
        // Save user's address so we can reply later,
        // ... will be passed as state during authentication
        var stateObject = {
            address: session.message.address,
            text: session.message.text
        };
        //var message = session.message.text;

        // Figure out what the user is trying to say
        luis.getIntent(session.message.text, function(err, response) {
            var intent = response.topScoringIntent.intent;
            var entities = response.entities;

            switch (intent) {
                case 'Login':
                    // Package state along with the auth url
                    console.log('... to Login intent');
                    var stateObjectBuffer = new Buffer(JSON.stringify(stateObject)).toString('base64');
                    var card = new builder.SigninCard(session)
                        .text('TripIt Sign-in')
                        .button('Sign-in', tripit_auth_url + 'auth/tripit?' + '&state=' + stateObjectBuffer);

                    var msg = new builder.Message(session).addAttachment(card);

                    // If message was typed in a group/channel, turn it into PM as this is login
                    if ((typeof session.message.address.conversation.name !== 'undefined') && (session.message.address.channelId != 'webchat')) delete session.message.address.conversation;

                    session.send(msg);
                    //session.send(JSON.stringify(stateObject));
                    //session.send('Click to login: ' + tripit_auth_url + 'auth/tripit?' + '&state=' + stateObjectBuffer);
                    break;
                case 'Greet':
                    var greetings = ['Hey', 'Yo', 'Whatup', 'Hiya', 'Yeah?', 'Lol', 'Upupdowndown', 'Bonjour', 'Hola', 'Guten tag', 'Ciao', 'Kamusta', 'Namaste'];
                    session.send(greetings[Math.floor(Math.random() * greetings.length)]);
                    break;
                case 'GetTrips':
                    //session.send('Get Trips');

                    var address = session.message.address;
                    var id = address.user.id;
                    var name = address.user.name;
                    var channelId = address.channelId;
                    var serviceUrl = address.serviceUrl;

                    //TODO: Per https://docs.botframework.com/en-us/node/builder/chat/session/#navtitle
                    // 'dangerous to use session' - advisable to use proactive message with bot.send for
                    // long running tasks

                    //TODO: Skip getCreds if creds already in userData
                    tripit.getCreds(id, name, channelId, serviceUrl)
                        .then((credArr) => {
                            //session.send(JSON.stringify(credArr[0]));
                            session.userData.tripit_auth = credArr[0].tripit_auth;
                        })
                        /* TOO SLOW, better off to call TripIt APIs here from bot, even if queues are warmed up
                        .then(() => {

                            var payload = {
                                'origin': 'bot',
                                'intent': 'trip_list',
                                'tripit_auth': session.userData.tripit_auth
                            };

                            var message = {
                                'address': address,
                                'payload': payload
                            }

                            queue.pushMessageQFunc(message, 'AzureWebJobsStorageQ', 'js-queue-items')
                                .then(() => {
                                    console.log('List request queue message push');
                                    session.endDialog();
                                })
                                .catch((error) => {

                                    //context.done(error, null);
                                    console.log('Error list request queue push: ' + error);
                                    session.endDialog();
                                })
                        })
                        */
                        .then(() => {
                            return tripit.listTrips(session.userData.tripit_auth.tripit_token, session.userData.tripit_auth.tripit_tokenSecret);
                        })
                        .then((listArr) => {
                            var trips = JSON.parse(listArr).Trip;
                            var cards = [];
                            for (var i = 0, len = trips.length; i < len; i++) {
                                var card = new builder.ThumbnailCard(session)
                                    .title('Trip name: ' + trips[i].display_name)
                                    .subtitle(trips[i].start_date + ' - ' + trips[i].primary_location) //trips[i].start_date + ' - ' + trips[i].primary_location)
                                    .text('Your trip to ' + trips[i].primary_location + ' from ' + trips[i].start_date + ' to ' + trips[i].end_date) //+ trips[i].primary_location + ' from ' + trips[i].start_date + ' to ' + trips[i].end_date)
                                    .images([
                                        builder.CardImage.create(session, trips[i].image_url) //trips[i].image_url)
                                    ])
                                    .buttons([
                                        builder.CardAction.openUrl(session, 'https://www.tripit.com/trip/show/id/' + trips[i].id, 'View in TripIt'),
                                        //builder.CardAction.openUrl(session, 'https://www.tripit.com/trip/show/id/' + trips[i].id, 'Share Trip')
                                        builder.CardAction.dialogAction(session, "share", trips[i].id, "Share trip")
                                        //builder.CardAction.imBack(session, "<Message>", "<Button>")

                                    ]);
                                cards.push(card);
                            }

                            // create reply with Carousel AttachmentLayout
                            var reply = new builder.Message(session)
                                .attachmentLayout(builder.AttachmentLayout.carousel)
                                .attachments(cards);

                            session.send(reply);

                            //session.send('Trips: ' + trips);
                        })
                        .catch((error) => {
                            session.send('Error: ' + JSON.stringify(error));
                        });


                    //session.send('Address: ' + id + ' ' + name + ' ' + channelId + ' ' + serviceUrl);
                    break;
                case 'Random':
                    session.send('Random');
                    break;
                case 'Debug':
                    var message = {
                        'message': 'FUNC01'
                    };

                    queue.pushMessageQFunc(message, 'AzureWebJobsStorage', 'js-queue-items')
                        .then(() => {
                            session.send('Pushed: ' + JSON.stringify(message));
                            session.endDialog();
                        })
                        .catch((error) => {
                            session.send('Error: ' + error);
                            session.endDialog();
                        })

                    /*
                    queue.pushMessageQ(message, 'AzureWebJobsStorageQ','js-queue-items', function(err, response) {
                        session.send('Response: ' + response);
                        session.endDialog();
                    })
                    */

                    //session.send('Debug');
                    break;

            }

            //session.send(response.topScoringIntent.intent);
        });
    }
});

if (useEmulator) {
    var restify = require('restify');
    var server = restify.createServer();
    server.listen(3978, function() {
        console.log('test bot endpont at http://localhost:3978/api/messages');
    });
    server.post('/api/messages', connector.listen());
} else {
    module.exports = { default: connector.listen() }
}
