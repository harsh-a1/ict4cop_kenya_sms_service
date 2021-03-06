module.exports = new converter();

var moment = require('moment-timezone');
var constants = require('./constants');

var api = require('../../api')
var config = require('../../config.json');
var dhis2api = new api(config)

function converter(){

    function sumDigit(num){

        if (num < 10){
            return num;
        }else{
            return sumDigit(sum(num));
        }
        
        function sum(n){
            return n
                .toString()
                .split('')
                .map(Number)
                .reduce(function (a, b) {
                    return a + b;
                }, 0);
        }
    }

    
    function getOrgUnitByPhone(phone,callback){
        var url = "events.json?program="+constants.metadata.p_fieldAgent+"&filter="+constants.metadata.de_fieldAgentPhone+":eq:"+encodeURIComponent(phone);
        
        __logger.info(url);
        
        dhis2api.getObj(url,function(error,response,body){            
            if (error || !constants.isJson(body)){
                __logger.error("[SMS Import][Converter] Unable to fetch ou from phone. Aborting."+error+body);
                return
            }

            var _body = JSON.parse(body);

            if (!_body.events){
                __logger.error("[SMS Import][Converter] Error"+body)
                return
            }
            
            if (_body.events.length == 0){
                __logger.debug("[SMS Import][Converter] No event found for the phone number"+phone);
                callback(null);
                return
            }
            
            if (_body.events.length > 2){
                __logger.info("[SMS Import][Converter] More than on facility assigned to a field agent!!!");
            }

            __logger.debug("[SMS Import][Converter] Following Org Unit found for the phone number"+phone + "->"+_body.events[0].orgUnit);
            callback(_body.events[0].orgUnit);
        });
                
    }

    function getNumericID(id){
        return id.split("")
            .map(function(x){return x.charCodeAt()})
            .map(sumDigit)
            .join("");
    }
    
    this.getEventFromMessage = function(SMS,option,callback){

        getOrgUnitByPhone(SMS.from,function(orgUnit){
            __logger.debug("[SMS Import][Converter] OrgunitByPhone:"+ orgUnit);
            var eventDate = moment().tz("Africa/Nairobi").toISOString(true);
            eventDate = eventDate.split("+")[0];
            var event = {
                program : constants.metadata.p_smsInbox,
                orgUnit : orgUnit ? orgUnit : constants.metadata.root_ou,
                eventDate: eventDate,
                storedBy: "sms-integration",
                dataValues : []
            };
            
            var description = null;
            
            event.dataValues.push({
                dataElement : constants.metadata.de_origMsg,
                value : SMS.message
            });

            event.dataValues.push({
                dataElement : constants.metadata.de_timestamp,
                value : SMS.timestamp
            });
            
            event.dataValues.push({
                dataElement : constants.metadata.de_phoneNumber,
                value : SMS.from
            });
            
            event.dataValues.push({
                dataElement : constants.metadata.de_sms_id,
                value : SMS.id
            });
   
            var deVal_messageType = "spam";
            
            if (option){                
                deVal_messageType="valid";
            }

            if (!option && orgUnit){
                deVal_messageType="invalid";            
            }
        
            __logger.debug(deVal_messageType+JSON.stringify(option))

            event.dataValues.push({
                dataElement : constants.metadata.de_messageType,
                value : deVal_messageType
            });

            if (option){
                event.dataValues.push({
                    dataElement : constants.metadata.de_identifiedLevel,
                    value : option.code
                });
                
                description = option.name.split("(")[1];
                description = description.replace(")","");
                
                event.dataValues.push({
                    dataElement : constants.metadata.de_identifiedLevelDescription,
                    value : description
                });
            }

            var level0 = false;
            if (option){
                if (option.code == "Level 0"){
                    level0=true;
                }
            }
            
            if (deVal_messageType != "spam" && !level0){
 
                event.dataValues.push({
                    dataElement : constants.metadata.de_sms_offline_response_id,
                    value : getNumericID(SMS.id.split("-")[0])
                });
            }
            
            
            __logger.debug("[SMS Import][Converter] Event [ "+JSON.stringify(event));
            
            callback(event,deVal_messageType,description,orgUnit);           
        })
        
    }
    
}
