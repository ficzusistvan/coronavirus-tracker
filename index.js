const request = require('request')
const cheerio = require('cheerio')
const jsonframe = require('jsonframe-cheerio')
const tableparser = require('cheerio-tableparser')
const nodemailer = require('nodemailer')
const { google } = require("googleapis")
const OAuth2 = google.auth.OAuth2;
const nconf = require('nconf')
nconf.file({ file: 'config.json', search: true });

const CLIENT_ID = nconf.get('clientId');
const CLIENT_SECRET = nconf.get('clientSecret');
const REFRESH_TOKEN = nconf.get('refreshToken');

const oauth2Client = new OAuth2(
     CLIENT_ID, // ClientID
     CLIENT_SECRET, // Client Secret
     "https://developers.google.com/oauthplayground" // Redirect URL
);

oauth2Client.setCredentials({
     refresh_token: REFRESH_TOKEN
});
const accessToken = oauth2Client.getAccessToken()

const smtpTransport = nodemailer.createTransport({
     service: "gmail",
     auth: {
          type: "OAuth2",
          user: nconf.get('emailFrom'), 
          clientId: CLIENT_ID,
          clientSecret: CLIENT_SECRET,
          refreshToken: REFRESH_TOKEN,
          accessToken: accessToken
     }
});

request({ uri: 'https://www.worldometers.info/coronavirus/'}, (error, response, body) => {
    let $ = cheerio.load(body); // See Cheerio API
    
    jsonframe($); // apply the plugin to the current Cheerio instance
    tableparser($); // apply the plugin to the current Cheerio instance
    
    const mainDataFrame = {
        "Coronavirus Cases": "h1:contains('Coronavirus Cases:') + .maincounter-number",
        "Deaths": "h1:contains('Deaths:') + .maincounter-number",
        "Recovered": "h1:contains('Recovered:') + .maincounter-number"
    }

    const tmp = $('body').scrape(mainDataFrame);
    
    let emailHtml = '';
    for (let [key, value] of Object.entries(tmp)) {
        emailHtml += '<h3>' + key + ': ' + value + '</h3>';
    }
    
    const countriesTable = $("#main_table_countries_today").parsetable();
    
    for (var idx = 0; idx < countriesTable[0].length; idx++) {
        if (countriesTable[0][idx].includes('Romania')) {
            emailHtml += '<h2>Romania:</h2>';
            emailHtml += '<p>Total cases: <strong>' + countriesTable[1][idx] + '</strong></p>';
            emailHtml += '<p>New cases: <strong>' + countriesTable[2][idx] + '</strong></p>';
            emailHtml += '<p>Total deaths: <strong>' + countriesTable[3][idx] + '</strong></p>';
            emailHtml += '<p>New deaths: <strong>' + countriesTable[4][idx] + '</strong></p>';
            emailHtml += '<p>Total recovered: <strong>' + countriesTable[5][idx] + '</strong></p>';
            emailHtml += '<p>Active cases: <strong>' + countriesTable[6][idx] + '</strong></p>';
        }
    }

    const mailOptions = {
        from: nconf.get('emailFrom'),
        to: nconf.get('emailsTo'),
        subject: 'Coronavirus status',
        html: emailHtml
    };
 
    smtpTransport.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.log(error);
        } else {
            console.log('Email sent: ' + info.response);
        }
    });
});