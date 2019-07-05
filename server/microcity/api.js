const http = require('http');
const request = require('request');
const Q = require('q');

var options = {
    mimetypes: {
        json: ["application/json", "application/json; charset=utf-8"],
        xml: ["application/xml", "application/xml; charset=utf-8"]
    }
};

const Client = require('node-rest-client').Client;
const client = new Client(options);

const BASEURL = process.env.mctyBASEURL;
var accessToken;

//#region Acesso/Login
async function acessLogin() {

    var deferred = Q.defer();

    //Cliente com basic auth para realizar o login
    const options_auth = { user: process.env.mctyUser, password: process.env.mctyPassword };
    const login = new Client(options_auth);

    var path = '/rest_access';
    var URL = BASEURL + path;
    var args = {
        data: { rest_access: '' },
        headers: { "Content-Type": "application/json", "Accept": "application/json" }
    };

    try {
        if (accessToken == null) {

            login.post(URL, args, function (data, response) {
                accessToken = {};
                accessToken.token = data.rest_access.access_key;
                accessToken.date = data.rest_access.expiration_date;
                deferred.resolve(accessToken.token);
            }).on('error', function (err) {
                console.log('Something went wrong on the Access request ', err.request.options);
                throw err;
            });

        } else {
            deferred.resolve(accessToken.token);
        };

        return deferred.promise;

    } catch (err) {
        console.error("The Access request catch something wrong : ", err);
    };

};
//#endregion Acesso/Login 

//#region GET
function apiGET(path, xObjAttrs, accessToken) {

    var deferred = Q.defer();
    try {
        var URL = BASEURL + path;
        var args = {
            headers: { "Accept": "application/json", "X-Obj-Attrs": xObjAttrs, "X-AccessKey": accessToken }
        };

        client.get(URL, args, function (data, response) {
            if (data.buffer && data.buffer.byteLength == 0) {
                if (Buffer.isBuffer(data)) {
                    data = data.toString('utf8');
                }
                deferred.resolve(null);
            }
            else {
                deferred.resolve(data);
            }
        }).on('error', function (err) {
            console.log('Something went wrong on the GET request', err.request.options);
        });

        return deferred.promise;

    } catch (error) {
        console.error(error);
    }

};
//#endregion GET

//#region POST
function apiPOST(path, body, xObjAttrs, accessToken) {

    try {
        var deferred = Q.defer();
        var URL = BASEURL + path;
        var args = {
            data: body,
            //headers: { "Content-Type": "application/json", "Accept": "application/json", "X-Obj-Attrs": xObjAttrs, "X-AccessKey": accessToken }
            headers: { "Content-Type": "application/json", "X-Obj-Attrs": xObjAttrs, "X-AccessKey": accessToken }

        };

        client.post(URL, args, function (data, response) {
            if (data.buffer && data.buffer.byteLength == 0) {
                if (Buffer.isBuffer(data)) {
                    data = data.toString('utf8');
                }
                deferred.resolve(null);
            }
            else {
                deferred.resolve(data);
            }
        }).on('error', function (err) {
            console.log('something went wrong on the POST request', err.request.options);
        });

        return deferred.promise;
    } catch (error) {
        console.log("The POST request catch something wrong: ", error);
    }

}
//#endregion POST

//#region Consulta

function Consulta(method, path, xObjAttrs, body) {

    var deferred = Q.defer();

    try {
        acessLogin().then(function (accessToken) {
            switch (method) {
                case "GET":
                    apiGET(path, xObjAttrs, accessToken).then(function (response) {
                        deferred.resolve(response);
                    }).catch(function (erro) {
                        Console.error("Something went wrong on the GET call: ", erro);
                    });
                    break;

                case "POST":
                    apiPOST(path, body, xObjAttrs, accessToken).then(function (response) {
                        deferred.resolve(response);
                    }).catch(function (erro) {
                        Console.error("Something went wrong on the POST call: ", erro);
                    });
                    break;
            }
        }).catch(function (erro) {
            console.error("There's a problem with authentication of the service: ", erro);
        });

        return deferred.promise;
    } catch (error) {
        console.error(error);
    }


}

//#endregion Consulta


module.exports = {

    createIncidentIC: async function (incident) {
        //Método: Criação de incidente com IC identificado

        var path = "/in";
        var xObjAttrs = "ref_num, status";
        var body = {
            "in": {
                "customer": {
                    "@REL_ATTR": incident.customer
                },
                "z_contatolocal": incident.requester,
                "z_telefonelocal": incident.phone,
                "summary": incident.summary,
                "description": incident.description,
                "affected_resource": {
                    "@COMMON_NAME": incident.IC
                },
                "z_servico": {
                    "@COMMON_NAME": incident.service
                },
                "z_location": {
                    "@COMMON_NAME": incident.location
                },
                "z_logradouroIC": {
                    "@REL_ATTR": incident.locationId
                },
                "group": {
                    "@COMMON_NAME": "Support Center - 1º Nível"
                },
                "status": {
                    "@REL_ATTR": "ACK"
                }
            }
        };

        var response = await Consulta("POST", path, xObjAttrs, body);
        return response;
    },

    createIncidentICGeneric: async function (incident) {
        //Método: Criação de incidente com IC Genérico

        var path = "/in";
        var xObjAttrs = "ref_num, status";
        var body = {
            "in": {
                "customer": {
                    "@REL_ATTR": incident.customer
                },
                "z_contatolocal": incident.requester,
                "z_telefonelocal": incident.phone,
                "summary": incident.summary,
                "description": incident.description,
                "affected_resource": {
                    "@COMMON_NAME": "000000"
                },
                "z_servico": {
                    "@COMMON_NAME": "Serviço genérico"
                },
                "z_icbkp": {
                    "@REL_ATTR": "1"
                },
                "z_icinconsist": {
                    "@REL_ATTR": "1"
                },
                "z_info_lib": incident.info,
                "z_location": {
                    "@COMMON_NAME": incident.location
                },
                "z_logradouroIC": {
                    "@REL_ATTR": incident.locationId
                },
                "group": {
                    "@COMMON_NAME": "Support Center - 1º Nível"
                },
                "status": {
                    "@REL_ATTR": "ACK"
                }
            }
        };

        var response = await Consulta("POST", path, xObjAttrs, body);
        return response;

    },

    createIncidentInconsistentIC: async function (incident) {

        var path = "/in";
        var xObjAttrs = "ref_num, status";
        var body = {
            "in": {
                "customer": {
                    "@REL_ATTR": incident.customer
                },
                "z_contatolocal": incident.requester,
                "z_telefonelocal": incident.phone,
                "summary": incident.summary,
                "description": incident.description,
                "affected_resource": {
                    "@COMMON_NAME": incident.IC
                },
                "z_servico": {
                    "@COMMON_NAME": incident.service
                },
                "z_location": {
                    "@COMMON_NAME": incident.location
                },
                "z_logradouroIC": {
                    "@REL_ATTR": incident.locationId
                },
                "group": {
                    "@COMMON_NAME": "Support Center - 1º Nível"
                },
                "status": {
                    "@REL_ATTR": "ACK"
                },
                "z_icinconsist": {
                    "@REL_ATTR": "1"
                },
                "z_info_lib": incident.info
            }
        }

        var response = await Consulta("POST", path, xObjAttrs, body);
        return response;
    },

    createIncidentAddressNotFound: async function (incident) {

        var path = "/in";
        var xObjAttrs = "ref_num, status";
        var body = {
            "in": {
                "customer": {
                    "@REL_ATTR": incident.customer
                },
                "z_contatolocal": incident.requester,
                "z_telefonelocal": incident.phone,
                "summary": incident.summary,
                "description": incident.description,
                "affected_resource": {
                    "@COMMON_NAME": incident.IC
                },
                "z_servico": {
                    "@COMMON_NAME": incident.service
                },
                "z_location": {
                    "@COMMON_NAME": incident.location
                },
                "group": {
                    "@COMMON_NAME": "Support Center - 1º Nível"
                },
                "status": {
                    "@REL_ATTR": "ACK"
                },
                "z_icinconsist": {
                    "@REL_ATTR": "1"
                },
                "z_lognaolocalizado": {
                    "@REL_ATTR": "1"
                },
                "z_info_lib": incident.info
            }
        }

        var response = await Consulta("POST", path, xObjAttrs, body);
        return response;
    },

    createSolicitationIC: async function (solicitation) {
        //Criação de solicitação com IC identificado

        var path = "/cr";
        var xObjAttrs = "ref_num, status";
        var body = {
            "cr": {
                "customer": {
                    "@REL_ATTR": solicitation.customer
                },
                "z_contatolocal": solicitation.requester,
                "z_telefonelocal": solicitation.phone,
                "summary": solicitation.summary,
                "description": solicitation.description,
                "affected_resource": {
                    "@COMMON_NAME": solicitation.IC
                },
                "z_servico": {
                    "@COMMON_NAME": solicitation.service
                },
                "z_location": {
                    "@COMMON_NAME": solicitation.location
                },
                "z_logradouroIC": {
                    "@REL_ATTR": solicitation.locationId
                },
                "group": {
                    "@COMMON_NAME": "Support Center - 1º Nível"
                },
                "status": {
                    "@REL_ATTR": "ACK"
                }
            }
        };
        var response = await Consulta("POST", path, xObjAttrs, body);
        return response;
    },

    createSolicitationICGeneric: async function (solicitation) {
        //Criação de solicitação com IC Genérico

        var path = "/cr";
        var xObjAttrs = "ref_num, status";
        var body = {
            "cr": {
                "customer": {
                    "@REL_ATTR": solicitation.customer
                },
                "z_contatolocal": solicitation.requester,
                "z_telefonelocal": solicitation.phone,
                "summary": solicitation.summary,
                "description": solicitation.description,
                "affected_resource": {
                    "@COMMON_NAME": "000000"
                },
                "z_servico": {
                    "@COMMON_NAME": "Serviço genérico"
                },
                "z_icbkp": {
                    "@REL_ATTR": "1"
                },
                "z_icinconsist": {
                    "@REL_ATTR": "1"
                },
                "z_info_lib": solicitation.info,
                "z_location": {
                    "@COMMON_NAME": solicitation.location
                },
                "z_logradouroIC": {
                    "@REL_ATTR": solicitation.locationId
                },
                "group": {
                    "@COMMON_NAME": "Support Center - 1º Nível"
                },
                "status": {
                    "@REL_ATTR": "ACK"
                }
            }
        };
        var response = await Consulta("POST", path, xObjAttrs, body);
        return response;
    },

    createSolicitationWithoutIC: async function (solicitation) {
        //Método: Criação de solicitação sem IC

        var path = "/cr";
        var xObjAttrs = "ref_num, status";
        var body = {
            "cr": {
                "customer": {
                    "@REL_ATTR": solicitation.customer
                },
                "z_contatolocal": solicitation.requester,
                "z_telefonelocal": solicitation.phone,
                "summary": solicitation.summary,
                "description": solicitation.description,
                "z_servico": {
                    "@COMMON_NAME": "Solicitação de serviços"
                },
                "z_location": {
                    "@COMMON_NAME": solicitation.location
                },
                "z_logradouroIC": {
                    "@REL_ATTR": solicitation.locationId
                },
                "group": {
                    "@COMMON_NAME": "Support Center - 1º Nível"
                },
                "status": {
                    "@REL_ATTR": "ACK"
                }
            }
        };

        var response = await Consulta("POST", path, xObjAttrs, body);
        return response;
    },

    createSolicitationInconsistentIC: async function (solicitation) {

        var path = "/cr";
        var xObjAttrs = "ref_num, status";
        var body = {
            "cr": {
                "customer": {
                    "@REL_ATTR": solicitation.customer
                },
                "z_contatolocal": solicitation.requester,
                "z_telefonelocal": solicitation.phone,
                "summary": solicitation.summary,
                "description": solicitation.description,
                "z_servico": {
                    "@COMMON_NAME": "Solicitação de serviços"
                },
                "z_location": {
                    "@COMMON_NAME": solicitation.location
                },
                "group": {
                    "@COMMON_NAME": "Support Center - 1º Nível"
                },
                "status": {
                    "@REL_ATTR": "ACK"
                },
                "z_icinconsist": {
                    "@REL_ATTR": "1"
                },
                "z_info_lib": "Logradouro do item informado pelo usuário está diferente do cadastrado no IC. Cliente: " + solicitation.organization + ", Endereço cadastrado: " + solicitation.address1 + ", Endereço Informado: " + solicitation.address2
            }
        }

        var response = await Consulta("POST", path, xObjAttrs, body);
        return response;
    },

    createSolicitationAddressNotFound: async function (solicitation) {
        var path = "/cr";
        var xObjAttrs = "ref_num, status";
        var body = {
            "cr": {
                "customer": {
                    "@REL_ATTR": solicitation.customer
                },
                "z_contatolocal": solicitation.requester,
                "z_telefonelocal": solicitation.phone,
                "summary": solicitation.summary,
                "description": solicitation.description,
                "affected_resource": {
                    "@COMMON_NAME": solicitation.IC
                },
                "z_servico": {
                    "@COMMON_NAME": solicitation.service
                },
                "z_location": {
                    "@COMMON_NAME": solicitation.location
                },
                "group": {
                    "@COMMON_NAME": "Support Center - 1º Nível"
                },
                "status": {
                    "@REL_ATTR": "ACK"
                },
                "z_icinconsist": {
                    "@REL_ATTR": "1"
                },
                "z_lognaolocalizado": {
                    "@REL_ATTR": "1"
                },
                "z_info_lib": solicitation.info
            }
        }

        var response = await Consulta("POST", path, xObjAttrs, body);
        return response;
    },

    createContact: async function (contact) {
        //Método: Criação de contato

        var path = "/cnt";
        var xObjAttrs = "userid, last_name,email_address";
        var body = {
            "cnt": {
                "last_name": contact.name,
                "userid": contact.email,
                "email_address": contact.email,
                "phone_number": contact.phone,
                "organization": {
                    "@REL_ATTR": contact.organization
                },
                "tenant": {
                    "@REL_ATTR": contact.tenant
                },
                "contact_num": "mcty@2018", //dado estático
                "notify_method1": { "@COMMON_NAME": "Email" }, //dado estático
                "notify_method2": { "@COMMON_NAME": "Email" }, //dado estático
                "notify_method3": { "@COMMON_NAME": "Email" }, //dado estático
                "notify_method4": { "@COMMON_NAME": "Email" }, //dado estático
                "notify_ws1": { "@COMMON_NAME": "24 horas" }, //dado estático
                "notify_ws2": { "@COMMON_NAME": "24 horas" }, //dado estático
                "notify_ws3": { "@COMMON_NAME": "24 horas" }, //dado estático
                "notify_ws4": { "@COMMON_NAME": "24 horas" }, //dado estático
                "type": { "@COMMON_NAME": "Usuário" }, //dado estático
                "access_type": { "@COMMON_NAME": "Funcionário" }, //dado estático
                "confirm_save": 1, //dado estático
                "schedule": { "@COMMON_NAME": "MicrocityCalend" } //dado estático

            }
        };

        var response = await Consulta("POST", path, xObjAttrs, body);
        return response;

    },

    createTranshipment: async function (description, ic) {

        var path = "/cr";
        var xObjAttrs = "ref_num, status, summary";
        var body = {
            "cr": {
                "customer": {
                    "@COMMON_NAME": "Chatbot Microcity"
                },
                "z_contatolocal": "Chatbot Microcity",
                "z_telefonelocal": "(31) 2125-4200",
                "summary": description.title,
                "description": description.text,
                "affected_resource": {
                    "@COMMON_NAME": ic
                },
                "z_servico": {
                    "@COMMON_NAME": "SERVIÇO CORPORATIVO MICROCITY"
                },
                "z_location": {
                    "@COMMON_NAME": "Brasil/Minas Gerais/Nova Lima"
                },
                "z_logradouroIC": {
                    "@REL_ATTR": "U'E4EF043D77FE7940AEA2DE7688FD66EF'"
                },
                "group": {
                    "@COMMON_NAME": "Support Center - 1º Nível"
                },
                "status": {
                    "@REL_ATTR": "OP"
                },
                "category": {
                    "@COMMON_NAME": "Chatbot.Resumo do chamado"
                },
                "priority": {
                    "@COMMON_NAME": "2-Alta"
                }
            }
        };

        var response = await Consulta("POST", path, xObjAttrs, body);
        return response;
    },

    queryUserByEmail: async function (email) {
        //Método: Consulta de usuário/solicitante a partir do e-mail

        var path = "/cnt?WC=email_address%3D'" + email + "'";
        var xObjAttrs = "last_name, userid, organization,email_address, phone_number";

        try {
            var response = await Consulta("GET", path, xObjAttrs)
            return response;
        } catch (error) {
            console.error('queryUserById has found some error: ', error);
        }


    },

    queryICbyId: async function (name) {
        //Método: Consulta de item de configuração por Nro de Série

        var path = "/nr?WC=name%3D'" + name + "'";
        var xObjAttrs = "name,family,class,z_model,z_fabricante, service_org,z_empresa_instalado,z_grupo_suporte1,delete_flag,z_str_etiqueta,z_serial_number";

        var response = await Consulta("GET", path, xObjAttrs);
        return response;
    },

    queryICbyTag: async function (tag, organization) {
        //Método: Consulta de item de configuração por Etiqueta

        var path = "/nr?WC=delete_flag%3D'0'%20and%20z_str_etiqueta%3D'" + tag + "'%20and%20service_org%3D" + organization;
        var xObjAttrs = "name, family, class, z_model, z_fabricante, service_org, z_empresa_instalado, z_grupo_suporte1, delete_flag, z_str_etiqueta,z_serial_number, z_ic_bloqueado";

        var response = await Consulta("GET", path, xObjAttrs);
        return response;
    },

    queryICbySerialNumber: async function (serialNumber, organization) {
        //Método: Consulta de item de configuração por Nro de Série

        var path = "/nr?WC=delete_flag%3D'0'%20and%20z_serial_number%3D'" + serialNumber + "'%20and%20service_org%3D" + organization;
        var xObjAttrs = "name, family, class, z_model, z_fabricante, service_org, z_empresa_instalado, z_grupo_suporte1, delete_flag, z_str_etiqueta,z_serial_number, z_ic_bloqueado";

        var response = await Consulta("GET", path, xObjAttrs);
        return response;
    },

    queryICGeneric: async function () {
        // Método: Consulta do item de configuração genérico

        var path = "/nr?WC=name%3D'000000'";
        var xObjAttrs = "name,family, class, z_model, z_fabricante, service_org, z_empresa_instalado, z_grupo_suporte1";

        var response = await Consulta("GET", path, xObjAttrs);
        return response;
    },

    queryServiceRelationshipIC: async function (srIC) {
        //Método: Consulta de relacionamento de serviço com item de configuração

        //           bmhier?WC=ci_rel_type.parenttochild%3D'é o serviço do item' and child.name%3D'445972' and delete_flag%3D0
        var path = "/bmhier?WC=ci_rel_type.parenttochild%3D'é o serviço do item'%20and%20child.name%3D'" + srIC + "'%20and%20delete_flag%3D0";
        var xObjAttrs = "child,ci_rel_type,parent";

        var response = await Consulta("GET", path, xObjAttrs);
        return response;
    },

    queryLocationByNumber: async function (address, organization) {
        //Método: Consulta de local
        var path = "/loc?WC=name%20LIKE%20'%25" + address + "%25'%20and%20z_organization.name%20LIKE%20'%25" + organization + "%25'%20and%20delete_flag=0";
        var xObjAttrs = "name,z_razaosocial,state,address2,z_organization";

        var response = await Consulta("GET", path, xObjAttrs);
        return response;
    },

    queryLocation: async function (address, organization) {
        //Método: Consulta de local

        var path = "/loc?WC=name%3D'" + address + "'%20and%20z_organization.name%20LIKE%20'%25" + organization + "%25'%20and%20delete_flag=0";
        var xObjAttrs = "name,z_razaosocial,state,address2,z_organization";

        var response = await Consulta("GET", path, xObjAttrs);
        return response;
    },

    queryCity: async function (city) {

        var path = "/state?WC=delete_flag%3D'0'%20and%20z_cidade='" + city + "'";
        var xObjAttrs = "sym, z_cidade, z_estado, z_str_sigla_estado, z_pais";

        var response = await Consulta("GET", path, xObjAttrs);
        return response;

    },

    queryOpenTickets: async function (email) {
        //Método: Consulta tickets abertos por e-mail do solicitante

        var path = "/cr?WC=customer.email_address%3D'" + email + "' and active%3D1";
        var xObjAttrs = "customer,ref_num,affected_resource,type,status,active,summary,description";

        var response = await Consulta("GET", path, xObjAttrs);
        return response;
    },

    queryClosedTickets: async function (email) {
        //Método: Consulta tickets fechados por e-mail do solicitante

        var path = "/cr?WC=customer.email_address%3D'" + email + "' and active%3D0";
        var xObjAttrs = "customer,ref_num,affected_resource,type,status,active,summary,description,z_solucao";

        var response = await Consulta("GET", path, xObjAttrs);
        return response;
    },

    queryOpenTicketsSameIC: async function (serialNumber) {
        //Método: Consulta de tickets abertos para o mesmo IC

        var path = "/cr?WC=affected_resource.z_serial_number%3D'" + serialNumber + "'";
        var xObjAttrs = "ref_num,affected_resource";

        var response = await Consulta("GET", path, xObjAttrs);
        return response;
    },

    queryOrganization: async function (organization) {
        //Método: Consulta de empresa

        var path = "/org?WC=delete_flag%3D'0'%20and%20name%20LIKE%20'%25" + organization + "%25'%20and%20z_tipo %21%3D'Fornecedor'";
        var xObjAttrs = "name,z_razaosocial,z_tipo,location,delete_flag";

        var response = await Consulta("GET", path, xObjAttrs);
        return response;
    },

    queryTenants: async function (organization) {
        //Método: Consulta de tenants (inquilinos)

        var path = "/tenant?WC=z_srl_organization.name%3D'" + organization + "'";
        var xObjAttrs = "name,parent,z_srl_organization";

        var response = await Consulta("GET", path, xObjAttrs);
        return response;
    },

    queryTenantsMicrocity: async function () {
        //Método: Consulta de tenants (inquilinos) para a Microcity

        var path = "/tenant?WC=name%3D'MICROCITY'";
        var xObjAttrs = "name,parent,z_srl_organization";

        var response = await Consulta("GET", path, xObjAttrs);
        return response;
    },

    queryChatBotIC: async function () {
        var path = "/nr?WC=z_model%3D'CHATBOT MICROCITY'";
        var xObjAttrs = "name, z_model";

        var response = await Consulta("GET", path, xObjAttrs);
        return response;
    }
}