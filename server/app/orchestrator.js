const watson = require('../watson/assistant');
const microcity = require('../microcity/routerApi');

module.exports = {

    orchestrator: async function (msgFront) {

        var responseAssistant = await watson.message(msgFront);
        var msg = await flow(responseAssistant);

        async function flow(data) {
            if (data.context.action) {
                if (data.context.action == "transbordo") {
                    data.context.msgFinal = data.output.text;
                    data.context.status = "finish";
                    var transbordo = await microcity.conversation(data.context);
                    return await buildResponse({context: transbordo});

                }
                if (data.context.action == "finalizar") { 
                    data.context.msgFinal = data.output.text;
                    data.context.status = "finish";
                    return await buildResponse(data);
                } else {
                    return await searchApiData(data.context);
                }
            } else {
                return await buildResponse(data);
            }
        }

        //realiza consulta nas apis da Microcity e retorna os dados para o watson
        async function searchApiData(context) {
            var apiResponse = await microcity.conversation(context);
            apiResponse.action = "";
            var assistantResponse = await watson.feedback(apiResponse);

            if (assistantResponse.context.action) {
                return await flow(assistantResponse);
            } else {
                return await buildResponse(assistantResponse);
            }

        };

        //retorna os dados para o usuário.
        async function buildResponse(msg) {
            var dados = {
                context_id: msg.context.conversation_id,
                text: msg.input ? msg.input.text : '',
                message: msg.context.msgFinal ? msg.context.msgFinal : msg.output.text,
                status: msg.context.status
            }
            return await dados;
        };
        return await msg;
    }
};