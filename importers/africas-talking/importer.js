module.exports = new importer();

var api = require('../../api')
var converter = require('./converter');
var constants = require('./constants');

var config = require('../../config.json');
var dhis2api = new api(config)
var smsHelper= require('../../smsHelper');
var smsService = require('../../smsService.js');

var offlineResponder = require('./offlineResponder');

function importer(){

    this.isOfflineMessage = function(SMS,callback){

        dhis2api.getObj("userGroups?fields=id,name,code,users[id,phoneNumber,name,organisationUnits[id,name]]&paging=false",function(error,response,body){
            if (error){
                __logger.error("cannot fetch control room user group "+error.toString());
                return
            }

            var userGroups = JSON.parse(body).userGroups;

            var userGroupMap = userGroups.reduce(function(map,obj){
                map[obj.id] = obj;
                return map;
            },[]);
            
            var controlRoomUserG = userGroupMap[constants.metadata.usergroup_control_room];

            var flag = controlRoomUserG.users.reduce(function(flag,obj){
                
                if (obj.phoneNumber && obj.phoneNumber.includes(SMS.from)){
                    flag=true;
                }
                
                return flag;
            },false);

            if (flag){
                __logger.info("[Offline Response] Message from Control Group");

                // check for code
                var code = SMS.message.trim().substr(-8);
                var isnum = /^\d+$/.test(code);

                if (!isnum){
                    __logger.info("[Offline Response] Offline code numeric check failed...Passing to Importer!");
                    callback(false);
                    return
                }
                // send response
                callback(true)
                offlineRespond(SMS,code,userGroups)
                
            }else{
                callback(false)
            }
        })
    }

    function offlineRespond(SMS,code,userGroups){
       // __logger.debug("events?program="+constants.metadata.p_smsInbox+"&filter="+constants.metadata.de_sms_offline_response_id+":eq:"+code);
        dhis2api.getObj("events?program="+constants.metadata.p_smsInbox+"&filter="+constants.metadata.de_sms_offline_response_id+":eq:"+code,function(error,response,body){
            if (error){
                __logger.error("[Offline Response] Unable to fetch event from code."+error);
                return
            }

            var events = JSON.parse(body).events;
            if (events.length ==0){
                __logger.info("[Offline Response] No SMS with the specified code found. Aborting Offline Response"+code);
                sendSMS(SMS.from,"Dear Control Group User, No active message found in the system with code "+code);
                return;
            }
            
            var event = events[0];
            
            if (event.status == "COMPLETED"){
                __logger.info("[Offline Response] Already Completed Event. Aborting Offline Response"+code);
                sendSMS(SMS.from,`SMS with code${code} has already been responded.`);
                return
            }
            
            dhis2api.getObj("organisationUnits/"+event.orgUnit+"?fields=id,path",function(error,response,body){
                
                if (error){
                    __logger.error("[Offline Response]Unable to fetch event ou. Aborting.");
                    return
                }
                
                var ou = JSON.parse(body)
                new offlineResponder(SMS,event,ou,userGroups,function(){
                    
                });
            })
            
        });
        
        function sendSMS(to,message){
            smsService.sendSMS(to,message,function(error,response,body){
                if (error){
                    __logger.error("[Offline Response][Invalid Code] Problem sending SMS"+JSON.stringify(body));
                    return;
                    }
                __logger.info("[Offline Response][Invalid Code] SMS sent "+JSON.stringify(body));
                
            })
        }
        
    }

    this.init = function(SMS,callback){
        
        // fetch options        
        dhis2api.getObj("optionSets/"+constants.metadata.optionset_indicator_level+"?fields=id,name,options[id,name,code,attributeValues[value,attribute[id,name,code]]]",function(error,response,body){

            if (error){
                __logger.error("[SMS Import] Unable to fetch option set for Indicator Levels. Aborting.");
                callback(error)
                return
            }

            if (!constants.isJson(body)){
                __logger.error("[SMS Import] NoJSON - Unable to fetch option set for Indicator Levels. Aborting.");
                callback(true);
                return
            }
            
            var options = JSON.parse(body).options;
         //   __logger.debug("[SMS Import] Options Length"+options.length);
            
            optionCodeMap = options.reduce(function(map,obj){
                var key = obj.code;
		key = config.sms.shared_shortcode_prefix?config.sms.shared_shortcode_prefix+" ":"" + key;
		key = key.toLowerCase().replace(/\s\s+/g, ' ');
		map[key] = obj;
                return map;
            },[]);

            var smsKey = SMS.message.toLowerCase().replace(/\s\s+/g, ' ');

            var match = "";
            for (var key in optionCodeMap){
                if (smsKey.startsWith(key)){
                    if (key.length > match.length){
                        match = key;
                    }
                }
            }

            converter.getEventFromMessage(SMS,optionCodeMap[match],postEventCreation);
            
        });

        function postEventCreation(event,messageType,description,orgUnit){

            __logger.info("[SMS Import] Creating Event");
            dhis2api.save("events?",event,function(error,response,body){

                if (error){
                    __logger.error("[SMS Import] Error while saving event");
                    callback(error);
                    return;
                }

                __logger.info("[SMS Import] Message Imported as Event with id["+SMS.id+"]");

                const whitelist = ['httpStatus',
                                   'httpStatusCode',
                                   'status',
                                   'message'
                                  ]
                __logger.info("[SMS Import] "+JSON.stringify(body,[whitelist]));
                __logger.debug("[SMS Import] "+JSON.stringify(body));

       
                callback(null,messageType,description);
                smsHelper.autoForwardToControlGroup(event,
                                                    SMS,
                                                    description,
                                                    messageType,
                                                    orgUnit,
                                                    function(){ })
                
            })
        }        
    }

}
