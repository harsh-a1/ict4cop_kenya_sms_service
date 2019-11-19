var moment = require("moment");
var express = require('express');
var config = require('./config.json');
var importer = require('./importers/africas-talking/importer');


// Initialise
var app = express();
/**
 * Set up CORS Settings
 */ app.use(function (req, res, next) {

     // Website you wish to allow to connect
     res.setHeader('Access-Control-Allow-Origin', '*');

     // Request methods you wish to allow
     res.setHeader('Access-Control-Allow-Methods', 'GET, POST');

     // Request headers you wish to allow
     res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

     // Pass to next layer of middleware
     next();
 });/**
     */
var bodyParser = require('body-parser')
app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
    extended: true
}));


/** Set Up Logging
  var winston = require('winston');
global.__logger = winston.createLogger({
    level : 'silly',
    transports: [
        new (winston.transports.Console)({
            colorize: true,
            timestamp: true
        }),
        new (winston.transports.File)({
            filename: './logs/server.log',
            timestamp: true
        })
    ]
});
*/
const {transports, createLogger, format } = require('winston');
const winston = require('winston');
 let alignColorsAndTime = winston.format.combine(
        winston.format.colorize({
            all:true
        }),
        winston.format.label({
            label:'[LOGGER]'
        }),
        winston.format.timestamp({
            format:"YY-MM-DD HH:mm:ss"
        }),
     winston.format.prettyPrint(),

        winston.format.printf(
            info => ` ${info.label}  ${info.timestamp}  ${info.level} : ${info.message}`
        )
    );

global.__logger = createLogger({
    level:"silly",
    format: winston.format.combine(winston.format.colorize(), alignColorsAndTime),
    
    transports: [
        new transports.Console(),
        new transports.File({filename: 'logs/error.log', level: 'error'}),
        new transports.File({filename: 'logs/activity.log', level:'info'})
    ]
});
/**
 */

var server = app.listen(8010, function () {
    var host = server.address().address
    var port = server.address().port

    __logger.info("Server listening at http://%s:%s", host, port);
    
})

// Open API 
app.get('/importSMSIntoDHIS2', function(req, res){
    debugger
    var name = req.query.name
    var tei =req.query.tei
    var ou = req.query.ou;
    __logger.info("[ Incoming ] -> "+req);

    var body = {
        msg : "Level1 asdfuweyfgwuibd",
        sender : "+9199992923",
        timstamp : ""
    }

    importer.at2dhis2event(body,function(){
        res.writeHead(200, {'Content-Type': 'json'});
        res.end();    
    });
    
    
})


//var smsService = require('./smsService.js');
//smsService.sendSMS("40153","asdasdad")
