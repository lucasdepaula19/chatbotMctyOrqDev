const express = require('express');
const router = express.Router();
const orchestrator = require('../app/orchestrator');


router.post('/cognibot/conversation', async function (req, res) {

    if (req.body.text) {
        if (/[\n|\n\r]/.test(req.body.text)) {
            req.body.text = req.body.text.replace(/(\r\n|\n|\r)/gm, " ");
        }
    }

    var dados = {
        text: req.body.text,
        context_id: req.body.context_id,
        status: req.body.status,
    };

    var date = new Date();

    if (req.body.status == "inactive") {
        dados.status = "finish";
    };

    var response = await orchestrator.orchestrator(dados);

    var messages = await response.message.map((element) => {
        return {
            text: element,
            type: 'text'
        }
    });


    var resposta = await {
        context_id: response.context_id,
        text: response.text,
        status: response.status,
        messages: messages,
        finish_text: response.status == 'finish' ? messages[0].text : ''
    };

    // } else {
    //     var resposta = {
    //         context_id: req.body.context_id,
    //         text: req.body.text,
    //         status: req.body.status,
    //         messages: [{
    //             text: "Oi, ainda estou aqui.\n Para continuarmos, responda a última pergunta.",
    //             type: 'text'
    //         }],
    //         finish_text: ""
    //     }
    // }
    res.send(resposta);

});

router.get('/cognibot/config/:id', function (req, res) {

    var config = {
        cognibot_name: 'Olá!\nSou a Suzy 4',
        description_title: '',
        description_text: 'Estou pronta para abrir o seu chamado ou mostrar o status das suas solicitações de maneira rápida e fácil',
        avatar_url: '',
        cognibot_theme: ''
    };

    res.send(config);
});

module.exports = router;