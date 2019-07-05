const watson = require('watson-developer-cloud');
const Q = require('q');
const mongo = require('../database/mongo');

const workspace = process.env.assistantWorkspace;
const conversation = new watson.ConversationV1({
  username: process.env.assistantUsername,
  password: process.env.assistantPassword,
  version: process.env.assistantVersion
});

async function Assistant(msg, bd) {

  var deferred = Q.defer();

  if (msg.status == "start") {
    var contextMaster = {
      status: 'start'
    };
  } else {

    if (bd == true) {
      var id = msg.context_id ? msg.context_id : msg.conversation_id;
      var contextMaster = await mongo.find(id);
      contextMaster.status = msg.status;
      if (msg.text != null)
        contextMaster.lastInfo = msg.text;
    } else {
      var contextMaster = msg;
    }

  }

  if (msg.status == "finish") {
    contextMaster.status = msg.status;
    contextMaster.msgFinal = ["Numa próxima oportunidade a gente continua"];
  };

  conversation.message({ workspace_id: workspace, input: { 'text': msg.text }, context: contextMaster },
    async function (err, response) {
      if (err)
        console.log('Watson Assistant has found the follow error:', err);
      else {

        switch (response.context.status) {
          case "start":
            await mongo.insert(response.context.conversation_id, response.context)
            break;
          case "finish":
            await mongo.delete(response.context.conversation_id)
            break;
          default:
            await mongo.update(response.context.conversation_id, response.context)
            break;
        }

        deferred.resolve(response);
      }
    });
  return deferred.promise;
};

module.exports = {

  message: async function (msg) {
    var bd = true;
    var response = await Assistant(msg, bd);
    return response;
  },
  feedback: async function (msg) {
    var bd = false;
    var response = await Assistant(msg, bd);
    return response;
  }
};