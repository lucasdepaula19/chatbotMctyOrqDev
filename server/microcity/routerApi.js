const microcity = require('./api');
const NLU = require('../watson/nlu');
const Q = require('q');
const removeAccents = require('remover-acentos');
var fs = require('fs');

// ========================================== INFO ==========================================
// Esse JS tem as seguintes funções:
//  - Receber as Actions do Watson
//  - Estruturar os dados para consumir as API's da Microcity
//  - Encaminhar os dados para o endpoint de consumo de APIs e estruturar as respostas.
// ==========================================================================================

async function Watson(action) {
    //Actions são os triggers encaminhados pelo Watson.
    //Eles determinam quais são as API's da Microcity que precisam ser consumidas em cada momento.

    switch (action) {
        case "validaEmail":
            await queryUserbyEmail();
            await queryTickets();
            break;

        case "verificaEmail":
            await queryCreatedEmail();
            break;

        case "nlu":
            await NLUnome();
            break;

        case "validaEmpresa":
            await queryOrganization();
            if (context.empresa == true)
                await queryTenants();
            break;

        case "validaCadastro":
            await createContact();
            break;

        case "validaEtiquetaMicrocity":
            await queryICbyTag();
            break;

        case "validaFabricante":
            await queryICbySerialNumber();
            break;

        case "validaEndereco":
            await queryLocation();
            break;

        case "validaNumero":
            await queryLocationByNumber();
            break;

        case "confirmaCidade":
            await queryCity();
            break;

        case "geraChamado":
            await openTicket();
            break;

        case "buscaNumero":
            await queryTicketByNumber();
            break;

        case "transbordo":
            await createTranshipment();
            context.status = "finish";
            break;

        case "finalizar":
            context.status = "finish";
            break;

    };
};
async function createContact() {

    try {

        var contact = {
            name: context.dadosChamado.nomeConfirmado ? context.dadosChamado.nomeConfirmado : context.dadosChamado.nome,
            email: context.dadosChamado.email,
            phone: context.dadosChamado.telefone,
            organization: context.dadosChamado.empresaEscolhida.rel_attr,
            tenant: context.dadosChamado.empresaEscolhida.tenants.tenant
        };

        var user = await microcity.createContact(contact);

        if (user.cnt) {
            context.confirmaCadastro = true;
            context.cadastro = {
                nome: user.cnt.last_name,
                userid: user.cnt.userid,
                id: user.cnt['$'].id,
                rel_attr: user.cnt['$'].REL_ATTR
            };
            context.organization = {
                name: context.dadosChamado.empresaEscolhida.name,
                rel_attr: context.dadosChamado.empresaEscolhida.rel_attr
            };
            console.log(">>CONTATO CRIADO<< \n DATA: " + JSON.stringify(contact) + "\n CREATED: " + JSON.stringify(context.cadastro));

        }

    } catch (error) {
        console.error("Something went wrong on the 'createContact()' function. \n The aplication catch the follow error: ", error);
    }

};
async function createSolicitationIC() {
    try {

        var relationship = await microcity.queryServiceRelationshipIC(context.ICData.name);
        if (relationship.collection_bmhier['@COUNT'] == 0)
            context.transbordoBreadcrumb = 6;
        if (relationship.collection_bmhier['@COUNT'] == 1) {
            context.ICData.servicerelantioship = relationship.collection_bmhier.bmhier.parent['@COMMON_NAME'];
        } if (relationship.collection_bmhier['@COUNT'] > 1) {
            context.ICData.servicerelantioship = relationship.collection_bmhier.bmhier[0].parent['@COMMON_NAME']
        }

        await queryLocation();

        var solicitation = {
            customer: context.cadastro ? context.cadastro.rel_attr : context.user.rel_attr,
            requester: context.dadosChamado.nome,
            phone: context.dadosChamado.telefone,
            summary: context.dadosChamado.tipo + " - " + context.dadosChamado.item,
            description: context.dadosChamado.descricao,
            IC: context.ICData.affected_resource,
            service: context.ICData.servicerelantioship,
            location: context.address ? context.address.chosen : context.dadosChamado.enderecoEscolhido.state['@COMMON_NAME'],
            locationId: context.dadosChamado.locationId ? context.dadosChamado.locationId : context.dadosChamado.enderecoEscolhido['@REL_ATTR']
        };

        var request = await microcity.createSolicitationIC(solicitation);

        if (request.cr) {
            context.sucessoChamado = true;
            context.ticketOpen = {
                numero: request.cr.ref_num,
                status: request.cr.status['$'].COMMON_NAME
            };
            console.log(">>SOLICITAÇÃO COM IC<< \n DATA: " + JSON.stringify(solicitation) + "\n CREATED: " + JSON.stringify(context.ticketOpen));

        };

    } catch (error) {
        context.sucessoChamado = false;
        console.error("Something went wrong on the 'createSolicitationIC()' function. \n The aplication catch the follow error: ", error);
    }
};
async function createSolicitationWithoutIC() {

    try {

        var solicitation = {
            customer: context.cadastro ? context.cadastro.rel_attr : context.user.rel_attr,
            requester: context.dadosChamado.nome,
            phone: context.dadosChamado.telefone,
            summary: context.dadosChamado.tipo + " - " + (context.dadosChamado.item ? context.dadosChamado.item : 'Sem item de configuração'),
            description: context.dadosChamado.descricao,
            location: context.address ? context.address.chosen : context.dadosChamado.enderecoEscolhido.state['@COMMON_NAME'],
            locationId: context.dadosChamado.locationId ? context.dadosChamado.locationId : context.dadosChamado.enderecoEscolhido['@REL_ATTR']
        };

        var request = await microcity.createSolicitationWithoutIC(solicitation);

        if (request.cr) {
            context.sucessoChamado = true;
            context.ticketOpen = {
                numero: request.cr.ref_num,
                status: request.cr.status['$'].COMMON_NAME
            };
            console.log(">>SOLICITAÇÃO SEM IC<< \n DATA: " + JSON.stringify(solicitation) + "\n CREATED: " + JSON.stringify(context.ticketOpen));

        };

    } catch (error) {
        context.sucessoChamado = false;
        console.error("Something went wrong on the 'createSolicitationWithoutIC()' function. \n The aplication catch the follow error: ", error);
    }
}
async function createSolicitationICGeneric() {
    try {
        await queryLocation();
        var group = await microcity.queryICGeneric();

        var auxLoc = context.address ? context.address.chosen : context.dadosChamado.enderecoEscolhido.state['@COMMON_NAME']
        var solicitation = {
            customer: context.cadastro ? context.cadastro.rel_attr : context.user.rel_attr,
            requester: context.dadosChamado.nome,
            phone: context.dadosChamado.telefone,
            summary: context.dadosChamado.tipo + " - " + context.dadosChamado.item,
            description: "Descrição da demanda informada pelo usuário: " + context.dadosChamado.descricao + "\n Etiqueta ou Número de Série: " + context.tipoEtiqueta + "\n Tipo: " + context.generico.nomeItem + "\n Marca / Modelo: " + context.generico.nomeModelo + "\n Fabricante: " + context.generico.fabricante + "\n Localidade Informada: " + auxLoc,
            info: "IC genérico marcado. \n Cliente: " + context.organization.name + "\n Etiqueta ou Número de Série: " + context.tipoEtiqueta + "\n Tipo: " + context.generico.nomeItem + "\n Marca / Modelo: " + context.generico.nomeModelo + "\n Fabricante: " + context.generico.fabricante + "\n Endereço Informado" + auxLoc,
            location: context.address ? context.address.chosen : context.dadosChamado.enderecoEscolhido.state['@COMMON_NAME'],
            locationId: context.dadosChamado.locationId ? context.dadosChamado.locationId : context.dadosChamado.enderecoEscolhido['@REL_ATTR'],
            solvingGroup: group.collection_nr.nr.z_grupo_suporte1['@COMMON_NAME']
        };
        var request = await microcity.createSolicitationICGeneric(solicitation);

        if (request.cr) {
            context.sucessoChamado = true;
            context.ticketOpen = {
                numero: request.cr.ref_num,
                status: request.cr.status['$'].COMMON_NAME
            };
            console.log(">>SOLICITAÇÃO COM IC GENÉRICO<< \n DATA: " + JSON.stringify(solicitation) + "\n CREATED: " + JSON.stringify(context.ticketOpen));

        };

    } catch (error) {
        context.sucessoChamado = false;
        console.error("Something went wrong on the 'createSolicitationICGeneric()' function. \n The aplication catch the follow error: ", error);
    }
};
async function createSolicitationInconsistentIC() {
    try {

        var relationship = await microcity.queryServiceRelationshipIC(context.ICData.name);
        if (relationship.collection_bmhier['@COUNT'] == 0)
            context.transbordoBreadcrumb = 6;
        if (relationship.collection_bmhier['@COUNT'] == 1) {
            context.ICData.servicerelantioship = relationship.collection_bmhier.bmhier.parent['@COMMON_NAME'];
        } if (relationship.collection_bmhier['@COUNT'] > 1) {
            context.ICData.servicerelantioship = relationship.collection_bmhier.bmhier[0].parent['@COMMON_NAME']
        }

        await queryLocation();

        if (context.address || context.dadosChamado.enderecoEscolhido) {

            var solicitation = {
                customer: context.cadastro ? context.cadastro.rel_attr : context.user.rel_attr,
                requester: context.dadosChamado.nome,
                phone: context.dadosChamado.telefone,
                summary: context.dadosChamado.tipo + " - " + context.dadosChamado.item,
                description: "Descrição da demanda informada pelo usuário: " + context.dadosChamado.descricao + "\n Endereço cadastrado: " + context.ICData.address + "\n Endereço Informado: " + context.dadosChamado.endereco,
                IC: context.ICData.affected_resource,
                service: context.ICData.servicerelantioship,
                location: context.address ? context.address.chosen : context.dadosChamado.enderecoEscolhido.state['@COMMON_NAME'],
                locationId: context.dadosChamado.locationId ? context.dadosChamado.locationId : context.dadosChamado.enderecoEscolhido['@REL_ATTR'],
                info: "Endereço do item informado pelo usuário está diferente do cadastrado no IC. \nCliente: " + context.organization.name + "\n Número de Série: " + context.ICData.serialNumber + "\n Marca / Modelo: " + context.ICData.manufacturer + ", " + context.ICData.model + "\n Endereço cadastrado no IC: " + context.ICData.address + "\n Endereço Informado: " + context.dadosChamado.endereco,
            };

            var request = await microcity.createSolicitationInconsistentIC(solicitation);

            if (request.cr) {
                context.sucessoChamado = true;
                context.ticketOpen = {
                    numero: request.cr.ref_num,
                    status: request.cr.status['$'].COMMON_NAME
                };
                console.log(">>SOLICITAÇÃO COM IC INCONSISTENTE << \n DATA: " + JSON.stringify(solicitation) + "\n CREATED: " + JSON.stringify(context.ticketOpen));
            };

        } else {
            context.sucessoChamado = false;
        }

    } catch (error) {
        context.sucessoChamado = false;
        console.error("Something went wrong on the 'createSolicitationInconsistentIC()' function. \n The aplication catch the follow error: ", error);
    }
};
async function createSolicitationAddressNotFound() {

    try {

        var relationship = await microcity.queryServiceRelationshipIC(context.ICData.name);
        if (relationship.collection_bmhier['@COUNT'] == 0)
            context.transbordoBreadcrumb = 6;
        if (relationship.collection_bmhier['@COUNT'] == 1)
            context.ICData.servicerelantioship = relationship.collection_bmhier.bmhier.parent['@COMMON_NAME'];
        if (relationship.collection_bmhier['@COUNT'] > 1)
            context.ICData.servicerelantioship = relationship.collection_bmhier.bmhier[0].parent['@COMMON_NAME']


        var solicitation = {
            customer: context.cadastro ? context.cadastro.rel_attr : context.user.rel_attr,
            requester: context.dadosChamado.nome,
            phone: context.dadosChamado.telefone,
            summary: context.dadosChamado.tipo + " - " + context.dadosChamado.item,
            description: "Descrição da demanda informada pelo usuário " + context.dadosChamado.descricao + "\n Endereço Informado " + context.dadosChamado.endereco,
            IC: context.ICData.affected_resource,
            service: context.ICData.servicerelantioship,
            location: context.dadosChamado.estado,
            info: "Logradouro não localizado. \nCliente: " + context.organization.name + "\n Número de Série: " + context.ICData.serialNumber + "Marca / Modelo: " + context.ICData.manufacturer + ", " + context.ICData.model + "\n Endereço Informado: " + context.dadosChamado.endereco,
        };

        var request = await microcity.createSolicitationAddressNotFound(solicitation);

        if (request.cr) {
            context.sucessoChamado = true;
            context.ticketOpen = {
                numero: request.cr.ref_num,
                status: request.cr.status['$'].COMMON_NAME
            };
            console.log(">>SOLICITAÇÃO COM IC E ENDEREÇO NÃO ENCONTRADO<< \n DATA: " + JSON.stringify(solicitation) + "\n CREATED: " + JSON.stringify(context.ticketOpen));
        };

    } catch (error) {
        context.sucessoChamado = false;
        console.error("Something went wrong on the 'createSolicitationAddressNotFound()' function. \n The aplication catch the follow error: ", error);
    }
};
async function createIncidentIC() {
    try {

        var relationship = await microcity.queryServiceRelationshipIC(context.ICData.name);
        if (relationship.collection_bmhier['@COUNT'] == 0)
            context.transbordoBreadcrumb = 6;
        if (relationship.collection_bmhier['@COUNT'] == 1)
            context.ICData.servicerelantioship = relationship.collection_bmhier.bmhier.parent['@COMMON_NAME'];
        if (relationship.collection_bmhier['@COUNT'] > 1)
            context.ICData.servicerelantioship = relationship.collection_bmhier.bmhier[0].parent['@COMMON_NAME']

        await queryLocation();

        if (context.address || context.dadosChamado.enderecoEscolhido) {

            var incident = {
                customer: context.cadastro ? context.cadastro.rel_attr : context.user.rel_attr,
                requester: context.dadosChamado.nome,
                phone: context.dadosChamado.telefone,
                summary: context.dadosChamado.tipo + " - " + context.dadosChamado.item,
                description: context.dadosChamado.descricao,
                IC: context.ICData.affected_resource,
                service: context.ICData.servicerelantioship,
                location: context.address ? context.address.chosen : context.dadosChamado.enderecoEscolhido.state['@COMMON_NAME'],
                locationId: context.dadosChamado.locationId ? context.dadosChamado.locationId : context.dadosChamado.enderecoEscolhido['@REL_ATTR']
            };

            var request = await microcity.createIncidentIC(incident);

            if (request.in) {
                context.sucessoChamado = true;
                context.ticketOpen = {
                    numero: request.in.ref_num,
                    status: request.in.status['$'].COMMON_NAME
                };
                console.log(">>INCIDENTE COM IC<< \n DATA: " + JSON.stringify(incident) + "\n CREATED: " + JSON.stringify(context.ticketOpen));
            };

        } else {
            context.sucessoChamado = false;
        }

    } catch (error) {
        context.sucessoChamado = false;
        console.error("Something went wrong on the 'createIncidentIC()' function. \n The aplication catch the follow error: ", error);
    }
};
async function createIncidentICGeneric() {
    try {
        await queryLocation();
        var group = await microcity.queryICGeneric();
        let loc = context.address ? context.address.address.name : context.dadosChamado.enderecoEscolhido['@COMMON_NAME'];
        var incident = {
            customer: context.cadastro ? context.cadastro.rel_attr : context.user.rel_attr,
            requester: context.dadosChamado.nome,
            phone: context.dadosChamado.telefone,
            summary: context.dadosChamado.tipo + " - " + context.dadosChamado.item,
            description: "Descrição da demanda informada pelo usuário: " + context.dadosChamado.descricao + "\n Etiqueta ou Número de Série: " + context.tipoEtiqueta + "\n Tipo: " + context.generico.nomeItem + "\n Marca / Modelo: " + context.generico.nomeModelo + "\n Fabricante: " + context.generico.fabricante + "\n Endereço informado: " + loc,
            info: "IC genérico marcado. \n Cliente: " + context.organization.name + "\n Etiqueta ou Número de Série: " + context.tipoEtiqueta + "\n Tipo: " + context.generico.nomeItem + "\n Marca / Modelo: " + context.generico.nomeModelo + "\n Fabricante: " + context.generico.fabricante + "\n Endereço informado: " + context.dadosChamado.endereco,
            location: context.address ? context.address.chosen : context.dadosChamado.enderecoEscolhido.state['@COMMON_NAME'],
            locationId: context.dadosChamado.locationId ? context.dadosChamado.locationId : context.dadosChamado.enderecoEscolhido['@REL_ATTR'],
            solvingGroup: group.collection_nr.nr.z_grupo_suporte1['@COMMON_NAME']
        };
        var request = await microcity.createIncidentICGeneric(incident);
        if (request.in) {
            context.sucessoChamado = true;
            context.ticketOpen = {
                numero: request.in.ref_num,
                status: request.in.status['$'].COMMON_NAME
            };
            console.log(">>INCIDENTE COM IC GENÉRICO<< \n DATA: " + JSON.stringify(incident) + "\n CREATED: " + JSON.stringify(context.ticketOpen));

        };

    } catch (error) {
        context.sucessoChamado = false;
        console.error("Something went wrong on the 'createIncidentICGeneric()' function. \n The aplication catch the follow error: ", error);
    }
};
async function createIncidentInconsistentIC() {
    try {

        var relationship = await microcity.queryServiceRelationshipIC(context.ICData.name);
        if (relationship.collection_bmhier['@COUNT'] == 0)
            context.transbordoBreadcrumb = 6;
        if (relationship.collection_bmhier['@COUNT'] == 1) {
            context.ICData.servicerelantioship = relationship.collection_bmhier.bmhier.parent['@COMMON_NAME'];
        } if (relationship.collection_bmhier['@COUNT'] > 1) {
            context.ICData.servicerelantioship = relationship.collection_bmhier.bmhier[0].parent['@COMMON_NAME']
        }

        await queryLocation();

        if (context.address || context.dadosChamado.enderecoEscolhido) {

            var incident = {
                customer: context.cadastro ? context.cadastro.rel_attr : context.user.rel_attr,
                requester: context.dadosChamado.nome,
                phone: context.dadosChamado.telefone,
                summary: context.dadosChamado.tipo + " - " + context.dadosChamado.item,
                description: "Descrição da demanda informada pelo usuário: " + context.dadosChamado.descricao + "\n Endereço cadastrado no IC: " + context.ICData.address + "\n Endereço Informado: " + context.dadosChamado.endereco,
                IC: context.ICData.affected_resource,
                service: context.ICData.servicerelantioship,
                location: context.address ? context.address.chosen : context.dadosChamado.enderecoEscolhido.state['@COMMON_NAME'],
                locationId: context.dadosChamado.locationId ? context.dadosChamado.locationId : context.dadosChamado.enderecoEscolhido['@REL_ATTR'],
                info: "Endereço do item informado pelo usuário está diferente do cadastrado no IC. \n Cliente: " + context.organization.name + "\n Número de Série: " + context.ICData.serialNumber + "\n Marca / Modelo: " + context.ICData.manufacturer + ", " + context.ICData.model + "\n Endereço cadastrado no IC: " + context.ICData.address + "\n Endereço Informado: " + context.dadosChamado.endereco,
            };

            var request = await microcity.createIncidentInconsistentIC(incident);

            if (request.in) {
                context.sucessoChamado = true;
                context.ticketOpen = {
                    numero: request.in.ref_num,
                    status: request.in.status['$'].COMMON_NAME
                };
                console.log(">>INCIDENTE COM IC INCONSISTENTE << \n DATA: " + JSON.stringify(incident) + "\n CREATED: " + JSON.stringify(context.ticketOpen));
            };

        } else {
            context.sucessoChamado = false;
        }

    } catch (error) {
        context.sucessoChamado = false;
        console.error("Something went wrong on the 'createIncidentInconsistentIC()' function. \n The aplication catch the follow error: ", error);
    }
};
async function createIncidentAddressNotFound() {
    try {

        var relationship = await microcity.queryServiceRelationshipIC(context.ICData.name);
        if (relationship.collection_bmhier['@COUNT'] == 0)
            context.transbordoBreadcrumb = 6;
        if (relationship.collection_bmhier['@COUNT'] == 1)
            context.ICData.servicerelantioship = relationship.collection_bmhier.bmhier.parent['@COMMON_NAME'];
        if (relationship.collection_bmhier['@COUNT'] > 1)
            context.ICData.servicerelantioship = relationship.collection_bmhier.bmhier[0].parent['@COMMON_NAME']

        var incident = {
            customer: context.cadastro ? context.cadastro.rel_attr : context.user.rel_attr,
            requester: context.dadosChamado.nome,
            phone: context.dadosChamado.telefone,
            summary: context.dadosChamado.tipo + " - " + context.dadosChamado.item,
            description: "Descrição da demanda informada pelo usuário: " + context.dadosChamado.descricao + "\n Endereço Informado: " + context.dadosChamado.endereco,
            IC: context.ICData.affected_resource,
            service: context.ICData.servicerelantioship,
            location: context.dadosChamado.estado,
            info: "Logradouro não localizado. \n Cliente: " + context.organization.name + "\n Número de Série: " + context.ICData.serialNumber + "\n Marca / Modelo: " + context.ICData.manufacturer + ", " + context.ICData.model + "\n Endereço Informado: " + context.dadosChamado.endereco,
        };

        var request = await microcity.createIncidentAddressNotFound(incident);

        if (request.in) {
            context.sucessoChamado = true;
            context.ticketOpen = {
                numero: request.in.ref_num,
                status: request.in.status['$'].COMMON_NAME
            };
            console.log(">>INCIDENTE COM IC E ENDEREÇO NÃO ENCONTRADO<< \n DATA: " + JSON.stringify(incident) + "\n CREATED: " + JSON.stringify(context.ticketOpen));
        };

    } catch (error) {
        context.sucessoChamado = false;
        console.error("Something went wrong on the 'createIncidentInconsistentIC()' function. \n The aplication catch the follow error: ", error);
    }
};
async function createTranshipment() {


    try {

        var title = "";
        var text = "";

        switch (context.transbordoBreadcrumb) {
            case 2:
                title = "TRANSBORDO CHATBOT - IDENTIFICAÇÃO DA INTENÇÃO";
                break;
            case 4:
                title = "TRANSBORDO CHATBOT - Identificação do endereço";
                break;
            case 5:
                title = "TRANSBORDO CHATBOT - Resumo do chamado";
                break;
            case 6:
                title = "TRANSBORDO CHATBOT - Identificação do serviço";
                break;
        };

        var endereco = context.address ? context.address.address['@COMMON_NAME'] : context.dadosChamado.endereco

        if (context.IC) {
            var etiquetaMicrocity = context.IC.tag ? context.IC.tag : '';
            var etiquetaFabricante = context.IC.serialNumber ? context.IC.serialNumber : '';
        }

        text += context.email ? 'E-mail: ' + context.email + "\n" : "";
        text += context.user ? 'Nome: ' + context.user.name + "\n" : 'Nome: ' + context.cadastro.nome + "\n";
        text += context.organization.name ? 'Empresa: ' + context.organization.name + "\n" : '';
        text += endereco ? 'Endereço: ' + endereco + "\n" : '';
        text += context.user ? 'Telefone: ' + context.user.phone + "\n" : 'Telefone: ' + context.dadosChamado.telefone + "\n";
        text += context.dadosChamado.descricao ? 'Descrição do chamado: ' + context.dadosChamado.descricao + "\n" : '';
        text += etiquetaMicrocity ? 'Etiqueta Microcity: ' + etiquetaMicrocity + "\n" : '',
            text += etiquetaFabricante ? 'Etiqueta Fabricante: ' + etiquetaFabricante + "\n" : '',
            text += context.dadosChamado.item ? 'Item: ' + context.dadosChamado.item + "\n" : "";
        text += context.dadosChamado.tipo ? 'Tipo de chamado: ' + context.dadosChamado.tipo + "\n" : '';
        text += 'Última informação digitada pelo cliente: ' + context.lastInfo;

        var description = {
            title: title ? title : "TRANSBORDO CHATBOT - Resumo do chamado",
            text: text
        };

        var ic = await microcity.queryChatBotIC();
        var transbordo = await microcity.createTranshipment(description, ic.collection_nr.nr['@COMMON_NAME']);
        if (transbordo) {
            context.transbordoOpen = transbordo.cr.ref_num;
            console.log(">>TRANSBORDO<< \n ID: " + transbordo.cr.ref_num + "\n INFO: " + JSON.stringify(description));
        }


    } catch (error) {
        console.error("Something went wrong on the 'createTranshipment()' function. \n The aplication catch the follow error: ", error);
    }

};
async function queryUserbyEmail() {

    try {
        var user = await microcity.queryUserByEmail(context.email.toLowerCase());

        if (user.collection_cnt['@COUNT'] == 1) {
            context.emailConfirmacao = true;
            context.user = {
                name: user.collection_cnt.cnt['@COMMON_NAME'],
                rel_attr: user.collection_cnt.cnt['@REL_ATTR'],
                organization: user.collection_cnt.cnt.organization['@COMMON_NAME'],
                phone: user.collection_cnt.cnt.phone_number,
                email: user.collection_cnt.cnt.email_address
            };
            context.organization = {
                name: user.collection_cnt.cnt.organization['@COMMON_NAME'],
                rel_attr: user.collection_cnt.cnt.organization['@REL_ATTR']
            }
        }
        else {
            context.emailConfirmacao = false;
        }
    } catch (error) {
        console.error("Something went wrong on the 'queryUserbyEmail()' function. \n The aplication catch the follow error: ", error);
    }
};
async function queryCreatedEmail() {

    try {
        var user = await microcity.queryUserByEmail(context.emailCadastro.toLowerCase());

        if (user.collection_cnt['@COUNT'] == 0) {
            context.possuiEmail = false;
        }
        else {
            context.possuiEmail = true;
        }
    } catch (error) {
        console.error("Something went wrong on the 'queryCreatedEmail()' function. \n The aplication catch the follow error: ", error);
    }
};
async function queryTickets() {

    try {
        var open = await microcity.queryOpenTickets(context.email);
        context.tickets = [];
        context.possuiChamado = false;

        if (open.collection_cr["@COUNT"] == 1) {
            context.possuiChamado = true;
            if (!open.collection_cr.cr.affected_resource) {
                context.tickets.push(await genericIC(open.collection_cr.cr));
            } else {
                context.tickets.push(await notGenericIC(open.collection_cr.cr));
            }
        };
        if (open.collection_cr["@COUNT"] > 1) {

            context.possuiChamado = true;
            context.tickets = await Promise.all(open.collection_cr.cr.map(async (element) => {
                if (!element.affected_resource) {
                    return await genericIC(element);
                } else {
                    return await notGenericIC(element)
                }
            })).catch(e => {
                console.error("The map that fetched the open tickets broke for the following reason: ", e);
            });
        };

        function genericIC(element) {
            if (element.description.includes("Descrição da demanda informada pelo usuário")) {
                let textoReplace = "<break>";
                let aux = element.description.replace(/(\r\n|\n|\r)/gm, textoReplace);
                aux = aux.replace("Descrição da demanda informada pelo usuário:", "");
                aux = aux.substring(1, aux.indexOf(textoReplace));
                element.description = aux;
            }
            return {
                possuiIC: false,
                open: element.active["@COMMON_NAME"],
                ticket: element["@COMMON_NAME"],
                description: element.description,
                summary: element.summary,
                IC: {
                    class: 'Chamado sem IC',
                    n_serie: 'Chamado sem IC'
                },
                status: element.status["@COMMON_NAME"],
                type: element.type["@COMMON_NAME"]
            }
        };

        async function notGenericIC(element) {
            var IC = await microcity.queryICbyId(element.affected_resource["@COMMON_NAME"]);
            if (element.description.includes("Descrição da demanda informada pelo usuário")) {
                let textoReplace = "<break>";
                let aux = element.description.replace(/(\r\n|\n|\r)/gm, textoReplace);
                aux = aux.replace("Descrição da demanda informada pelo usuário:", "");
                aux = aux.substring(1, aux.indexOf(textoReplace));
                element.description = aux;
            }
            return {
                possuiIC: true,
                open: element.active["@COMMON_NAME"],
                ticket: element["@COMMON_NAME"],
                description: element.description,
                summary: element.summary,
                IC: {
                    class: IC.collection_nr.nr.class ? IC.collection_nr.nr.class["@COMMON_NAME"] : "",
                    address: IC.collection_nr.nr.z_empresa_instalado ? IC.collection_nr.nr.z_empresa_instalado["@COMMON_NAME"] : "",
                    manufacturer: IC.collection_nr.nr.z_fabricante ? IC.collection_nr.nr.z_fabricante["@COMMON_NAME"] : "",
                    n_serie: IC.collection_nr.nr.z_serial_number ? IC.collection_nr.nr.z_serial_number : ""
                },
                status: element.status["@COMMON_NAME"],
                type: element.type["@COMMON_NAME"]
            }
        }


    } catch (error) {
        console.error("Something went wrong on the 'queryTickets()' function. \n The aplication catch the follow error: ", error);
    }
};
async function queryOrganization() {

    try {

        var organization = await microcity.queryOrganization(await stopWordOrganization(context.organization.name));
        context.empresa = false;
        if (organization.collection_org['@COUNT'] == 1) {
            context.empresa = true;
            context.listaEmpresa = [];
            context.listaEmpresa[0] = {
                name: organization.collection_org.org['@COMMON_NAME'],
                rel_attr: organization.collection_org.org['@REL_ATTR']
            }
        }
        if (organization.collection_org['@COUNT'] > 1) {
            context.empresa = true;
            var organizations = await Promise.all(organization.collection_org.org.map(async (element) => {
                return {
                    name: element['@COMMON_NAME'],
                    rel_attr: element['@REL_ATTR']
                }
            }));
            context.listaEmpresa = organizations;
        };

    } catch (error) {
        console.error("Something went wrong on the 'queryOrganization()' function. \n The aplication catch the follow error: ", error);
    }
};
async function queryTenants() {

    try {

        var x = await Promise.all(context.listaEmpresa.map(async (element) => {
            var tenants = await microcity.queryTenants(await stopWordOrganization(element.name));
            if (tenants.collection_tenant['@COUNT'] == 1) {
                for (i = 0; i < context.listaEmpresa.length; i++) {
                    if (context.listaEmpresa[i].name == element.name) {
                        context.listaEmpresa[i].tenants = {
                            name: tenants.collection_tenant.tenant['@COMMON_NAME'],
                            tenant: tenants.collection_tenant.tenant['@REL_ATTR']
                        }
                    }
                }
            };
            if (tenants.collection_tenant['@COUNT'] == 0) {
                var tenantMicrocity = await microcity.queryTenantsMicrocity();
                for (i = 0; i < context.listaEmpresa.length; i++) {
                    if (context.listaEmpresa[i].name == element.name) {
                        context.listaEmpresa[i].tenants = {
                            name: tenantMicrocity.collection_tenant.tenant['@COMMON_NAME'],
                            tenant: tenantMicrocity.collection_tenant.tenant['@REL_ATTR']
                        }
                    }
                }
            };
            return null;
        }));
        await x;

    } catch (error) {
        console.error("Something went wrong on the 'queryTenants()' function. \n The aplication catch the follow error: ", error);
    }
};
async function queryICbyTag() {

    try {

        var ICdata = await microcity.queryICbyTag(await stopWord(context.IC.tag), context.organization.rel_attr);
        context.tipoEtiqueta = "Etiqueta da Microcity: " + context.IC.tag;
        if (ICdata.collection_nr['@COUNT'] == 1) {
            if (ICdata.collection_nr.nr.z_ic_bloqueado['@REL_ATTR'] == 1)
                context.icBloqueado = true;

            await itemType(ICdata.collection_nr.nr.class['@COMMON_NAME']);
            context.etiquetaMicrocity = true;

            context.tipoEtiqueta += "\nEtiqueta do Fabricante: " + ICdata.collection_nr.nr.z_serial_number;

            context.ICData = {
                name: ICdata.collection_nr.nr.name,
                itemType: ICdata.collection_nr.nr.class['@COMMON_NAME'],
                affected_resource: ICdata.collection_nr.nr.name,
                locationId: ICdata.collection_nr.nr.z_empresa_instalado['@REL_ATTR'],
                address: ICdata.collection_nr.nr.z_empresa_instalado['@COMMON_NAME'],
                address_rel_attr: ICdata.collection_nr.nr.z_empresa_instalado['@REL_ATTR'],
                model: ICdata.collection_nr.nr.z_model ? ICdata.collection_nr.nr.z_model : "",
                manufacturer: ICdata.collection_nr.nr.z_fabricante ? ICdata.collection_nr.nr.z_fabricante["@COMMON_NAME"] : "",
                serialNumber: ICdata.collection_nr.nr.z_serial_number
            }
        } else {
            context.etiquetaMicrocity = false;
        }
    } catch (error) {
        console.error("Something went wrong on the 'queryICbyTag()' function. \n The aplication catch the follow error: ", error);
    }

};
async function queryICbySerialNumber() {

    try {
        var ICdata = await microcity.queryICbySerialNumber(await stopWord(context.IC.serialNumber), context.organization.rel_attr);

        if (context.loopNSerie == true)
            context.tipoEtiqueta += "\nEtiqueta do Fabricante: " + context.IC.serialNumber;

        if (ICdata.collection_nr['@COUNT'] == 1) {
            if (context.loopNSerie != true)
                context.tipoEtiqueta += "\nEtiqueta do Fabricante: " + context.IC.serialNumber;

            if (ICdata.collection_nr.nr.z_ic_bloqueado['@REL_ATTR'] == 1)
                context.icBloqueado = true;

            await itemType(ICdata.collection_nr.nr.class['@COMMON_NAME']);
            context.etiquetaFabricante = true;

            context.ICData = {
                name: ICdata.collection_nr.nr.name,
                itemType: ICdata.collection_nr.nr.class['@COMMON_NAME'],
                affected_resource: ICdata.collection_nr.nr.name,
                locationId: ICdata.collection_nr.nr.z_empresa_instalado['@REL_ATTR'],
                address: ICdata.collection_nr.nr.z_empresa_instalado['@COMMON_NAME'],
                address_rel_attr: ICdata.collection_nr.nr.z_empresa_instalado['@REL_ATTR'],
                model: ICdata.collection_nr.nr.z_model ? ICdata.collection_nr.nr.z_model : "",
                manufacturer: ICdata.collection_nr.nr.z_fabricante["@COMMON_NAME"] ? ICdata.collection_nr.nr.z_fabricante["@COMMON_NAME"] : "",
                serialNumber: ICdata.collection_nr.nr.z_serial_number
            }
        } else {
            context.etiquetaFabricante = false;
            context.loopNSerie = true;
        }
    } catch (error) {
        console.error("Something went wrong on the 'queryICbySerialNumber()' function. \n The aplication catch the follow error: ", error);
    }

};
async function queryLocationByNumber() {
    try {
        context.transbordoBreadcrumb = 4;
        context.icinconsistent = true;
        await itemType();
        var location = await microcity.queryLocationByNumber(context.numeroEndereco, await stopWordOrganization(context.organization.name));
        context.endereco = false;
        context.listaEndereco = [];
        if (location.collection_loc['@COUNT'] == 1) {
            context.endereco = true;
            context.listaEndereco.push(location.collection_loc.loc);
        }
        if (location.collection_loc['@COUNT'] > 1) {
            context.endereco = true;
            context.listaEndereco = location.collection_loc.loc;
        }

    } catch (error) {
        console.error("Something went wrong on the 'queryLocationByNumber()' function. \n The aplication catch the follow error: ", error);
    }

};
async function queryLocation() {

    try {
        if (context.transbordoBreadcrumb && context.transbordoBreadcrumb < 4)
            context.transbordoBreadcrumb = 4;
        var location = await microcity.queryLocation(context.dadosChamado.endereco.toUpperCase(), context.organization.name);
        if (location.collection_loc['@COUNT'] == 1) {
            context.endereco = true;
            context.dadosChamado.locationId = location.collection_loc.loc['@REL_ATTR'];
            context.address = {
                address: location.collection_loc.loc,
                chosen: location.collection_loc.loc.state['@COMMON_NAME']
            }
        } else {
            context.endereco = false;
            context.AddressNotFound = true;
        }
    } catch (error) {
        console.error("Something went wrong on the 'queryLocation()' function. \n The aplication catch the follow error: ", error);
    }

};
async function queryCity() {

    try {
        context.transbordoBreadcrumb = 4;
        var location = await microcity.queryCity(context.cidade);
        context.cityFound = false;
        context.estadoCidadeDone = false;
        if (location.collection_state["@COUNT"] == 1) {
            context.cityFound = true;
            context.estadoCidadeDone = true;
            context.dadosChamado.estado = location.collection_state.state["@COMMON_NAME"]
        }
        if (location.collection_state["@COUNT"] > 1) {
            context.cityFound = true;
            context.estadosCidade = [];

            context.estadosCidade = await Promise.all(location.collection_state.state.map(async (element) => {
                return { state: element.z_estado, name: element["@COMMON_NAME"] }
            }));

            if (context.estado) {
                var x = await Promise.all(context.estadosCidade.map(async (element) => {
                    if (element.state == context.estado) {
                        context.dadosChamado.estado = element.name;
                        context.estadoCidadeDone = true;
                    }
                    return null;
                }));
            }
        };
    } catch (error) {
        console.error("Something went wrong on the 'queryCity()' function. \n The aplication catch the follow error: ", error);
    }
};
async function openTicket() {

    context.transbordoBreadcrumb = 5;
    switch (context.dadosChamado.tipo) {
        case 'Incidente':

            if (context.cityFound)
                return await createIncidentAddressNotFound();

            if (context.icinconsistent && !context.generico)
                return await createIncidentInconsistentIC();

            if (!context.generico)
                return await createIncidentIC();

            if (context.generico)
                return await createIncidentICGeneric();

            break;

        case 'Solicitação de Serviço':

            if (context.cityFound)
                return await createSolicitationAddressNotFound();

            if (context.icinconsistent && !context.generico && context.ICData)
                return await createSolicitationInconsistentIC();

            if (context.generico)
                return await createSolicitationICGeneric();

            if (!context.generico && context.ICData)
                return await createSolicitationIC();

            if (!context.generico && !context.ICData) {
                await queryLocation();
                return await createSolicitationWithoutIC();
            }
            break;
    }

};
async function queryTicketByNumber() {

    try {
        var open = await microcity.queryOpenTickets(context.email);

        if (open.collection_cr["@COUNT"] > 0) {

            var x = await Promise.all(open.collection_cr.cr.map(async (element) => {

                if (!element.affected_resource) {
                    if (element.description.includes("Descrição da demanda informada pelo usuário")) {
                        let textoReplace = "<break>";
                        let aux = element.description.replace(/(\r\n|\n|\r)/gm, textoReplace);
                        aux = aux.replace("Descrição da demanda informada pelo usuário:", "");
                        aux = aux.substring(1, aux.indexOf(textoReplace));
                        element.description = aux;
                    }
                    return {
                        possuiIC: false,
                        open: element.active["@COMMON_NAME"],
                        ticket: element["@COMMON_NAME"],
                        description: element.description,
                        summary: element.summary,
                        IC: {
                            class: 'Chamado sem IC',
                            n_serie: 'Chamado sem IC'
                        },
                        status: element.status["@COMMON_NAME"],
                        type: element.type["@COMMON_NAME"]
                    }
                } else {
                    var IC = await microcity.queryICbyId(element.affected_resource["@COMMON_NAME"]);
                    if (element.description.includes("Descrição da demanda informada pelo usuário")) {
                        let textoReplace = "<break>";
                        let aux = element.description.replace(/(\r\n|\n|\r)/gm, textoReplace);
                        aux = aux.replace("Descrição da demanda informada pelo usuário:", "");
                        aux = aux.substring(1, aux.indexOf(textoReplace));
                        element.description = aux;
                    }
                    return {
                        possuiIC: true,
                        open: element.active["@COMMON_NAME"],
                        ticket: element["@COMMON_NAME"],
                        description: element.description,
                        summary: element.summary,
                        IC: {
                            class: IC.collection_nr.nr.class ? IC.collection_nr.nr.class["@COMMON_NAME"] : "",
                            address: IC.collection_nr.nr.z_empresa_instalado ? IC.collection_nr.nr.z_empresa_instalado["@COMMON_NAME"] : "",
                            manufacturer: IC.collection_nr.nr.z_fabricante ? IC.collection_nr.nr.z_fabricante["@COMMON_NAME"] : "",
                            n_serie: IC.collection_nr.nr.z_serial_number ? IC.collection_nr.nr.z_serial_number : ""
                        },
                        status: element.status["@COMMON_NAME"],
                        type: element.type["@COMMON_NAME"]
                    }
                }

            })).catch(e => {
                console.error("The promisse that fetched open tickets by number has found some error: ", error);
            });

            context.verificaNumero = false;
            for (i = 0; i < x.length; i++) {
                if (x[i].ticket == context.numeroChamado.toUpperCase()) {
                    context.chamadoEscolhido = x[i];
                    context.verificaNumero = true;
                }
            }
        }
    } catch (error) {
        console.error("Something went wrong on the 'queryTicketByNumber()' function. \n The aplication catch the follow error: ", error);
    }

};
async function NLUnome() {
    var response = await NLU.analyze(context.dadosChamado.nome);
    if (response == null) {
        context.nomeEncontrado = false;
    }
    if (response && response.entities.length > 0) {
        var entities = await Promise.all(response.entities.map(async (element) => {
            if (element.type == "Person") {
                context.dadosChamado.nome = element.text;
                context.nomeEncontrado = true;
            }
        }));
    }
};
async function itemType(type) {
    //dados serão utilizados no momento de abrir o chamado
    if (type) {
        context.dadosChamado.item = type;
    } else {
        if (context.dadosChamado.hardware)
            context.dadosChamado.item = context.dadosChamado.hardware;
        if (context.dadosChamado.infraEstrutura)
            context.dadosChamado.item = context.dadosChamado.infraEstrutura;
        if (context.dadosChamado.software)
            context.dadosChamado.item = context.dadosChamado.software;
    }

};
async function stopWordOrganization(word) {

    try {
        var stopWordList = ["minha", "é", "empresa", "trabalho", "na", "a", "onde", "eu", "estou", "atualmente", "no", "trabalhando", "se", "chama", "nome", "razão social", "finalmente"];
        var lower = word.toLowerCase();
        var aux = lower.split(" ");

        var newAux = [];
        aux.forEach(element => {
            if (!stopWordList.includes(element)) {
                newAux.push(element);
            }
        });

        var data = '';
        newAux.forEach(element => {
            data += element + " "
        });

        data = data.indexOf("'") ? data.replace("'", "''") : data;
        return data.toUpperCase().trim();
    } catch (error) {
        console.error("Something went wrong on the 'stopWord()' function. \n The aplication catch the follow error: ", error);
    }
};
async function stopWord(word) {

    try {
        var stopWordList = [
            "a",
            "achei",
            "acho",
            "ao",
            "aos",
            "aquela",
            "aquelas",
            "aquele",
            "aqueles",
            "aqui",
            "aquilo",
            "as",
            "ate",
            "com",
            "como",
            "da",
            "das",
            "de",
            "dela",
            "delas",
            "dele",
            "deles",
            "depois",
            "do",
            "dos",
            "e",
            "eh",
            "ela",
            "elas",
            "ele",
            "eles",
            "em",
            "empresa",
            "entre",
            "era",
            "eram",
            "eramos",
            "essa",
            "essas",
            "esse",
            "esses",
            "esta",
            "estamos",
            "estao",
            "estas",
            "estava",
            "estavam",
            "estavamos",
            "este",
            "esteja",
            "estejam",
            "estejamos",
            "estes",
            "esteve",
            "estive",
            "estivemos",
            "estiver",
            "estivera",
            "estiveram",
            "estiveramos",
            "estiverem",
            "estivermos",
            "estivesse",
            "estivessem",
            "estivessemos",
            "estou",
            "etiqueta",
            "eu",
            "fabrica",
            "fabricante",
            "finalmente",
            "foi",
            "fomos",
            "for",
            "fora",
            "foram",
            "foramos",
            "forem",
            "formos",
            "fosse",
            "fossem",
            "fossemos",
            "fui",
            "funcionario",
            "ha",
            "haja",
            "hajam",
            "hajamos",
            "hao",
            "havemos",
            "havia",
            "hei",
            "houve",
            "houvemos",
            "houver",
            "houvera",
            "houveram",
            "houveramos",
            "houverao",
            "houverei",
            "houverem",
            "houveremos",
            "houveria",
            "houveriam",
            "houveriamos",
            "houvermos",
            "houvesse",
            "houvessem",
            "houvessemos",
            "isso",
            "isto",
            "ja",
            "lhe",
            "lhes",
            "mais",
            "mas",
            "me",
            "mesmo",
            "meu",
            "meus",
            "minha",
            "minhas",
            "moca",
            "muito",
            "na",
            "nao",
            "nas",
            "nem",
            "no",
            "nos",
            "nossa",
            "nossas",
            "nosso ",
            "nossos",
            "num",
            "numa",
            "numero",
            "o",
            "os",
            "ou",
            "para",
            "pela",
            "pelas",
            "pelo",
            "pelos",
            "por",
            "qual",
            "quando",
            "que",
            "quem",
            "sao",
            "se",
            "sei",
            "seja",
            "sejam",
            "sejamos",
            "sem",
            "ser",
            "sera",
            "serao",
            "serei",
            "seremos",
            "seria",
            "seriam",
            "seriamos",
            "seu",
            "seus",
            "sim",
            "so",
            "somos",
            "sou",
            "sua",
            "suas",
            "tambem",
            "te",
            "tem",
            "temos",
            "tenha",
            "tenham",
            "tenhamos",
            "tenho",
            "ter",
            "tera",
            "terao",
            "terei",
            "teremos",
            "teria",
            "teriam",
            "teriamos",
            "teu",
            "teus",
            "teve",
            "tinha",
            "tinham",
            "tinhamos",
            "tive",
            "tivemos",
            "tiver",
            "tivera",
            "tiveram",
            "tiveramos",
            "tiverem",
            "tivermos",
            "tivesse",
            "tivessem",
            "tivessemos",
            "trabalha",
            "trabalho",
            "trampo",
            "tu",
            "tua",
            "tuas",
            "um",
            "uma",
            "voce",
            "voces",
            "vos"
        ];
        var acento = word.replace(/[\.|,|;|-]/, "").trim();

        var lower = acento.toLowerCase();
        var aux = lower.split(" ");

        var newAux = [];
        aux.forEach(element => {
            if (!stopWordList.includes(removeAccents(element))) {
                newAux.push(element);
            }
        });
        var data = newAux.length == 1 ? newAux[0] : "";
        return data.toUpperCase();
    } catch (error) {
        console.error("Something went wrong on the 'stopWord()' function. \n The aplication catch the follow error: ", error);
    }

};

// Essa variável 'context' é comum para esse JS. Ela é preenchida inicialmente pela 'conversation'
// e alterada pelas funções acima, após a alteração os novos dados são retornados. 
var context;

module.exports = {

    conversation: async function (data) {
        context = data;
        await Watson(data.action);
        return context;
    }
};