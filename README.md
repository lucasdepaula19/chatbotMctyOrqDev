# Microcity

Orquestrador desenvolvido pela Kukac para a Microcity.
O orquestrador em questão realiza as conexões entre a IA Watson e o front, que juntos compõem o robô intitulado de Suzy 3.4.

## Instalação e execução

### Variáveis de ambiente

Para executar o projeto execute é necessário ter as seguintes variáveis de ambiente:

- assistantWorkspace='código do workspaceId do assistant'
- assistantUsername='código do usuário do assistant'
- assistantPassword='senha do usuário do assistant'
- assistantVersion='data da versão a ser utilizada'
- mongoURL='HTTP request do MongoDB'
- mongoDbName='nome do banco de dados que irá salvar o contexto'
- nluVersion='data da versão do NLU'
- nluURL='URL de acesso ao NLU'
- nluUsername='Usuário de acesso para o NLU criado'
- nluPasword='Senha de acesso ao NLU criado'
- mctyBASEURL='Raiz da URL das API's da Microcity <Esse campo aponta para os ambientes de DEV, QAS e PROD>'
- mctyUser='Usuário de autenticação com as API's da Microcity'
- mctyPassword='Senha de acesso para autenticação das API's Microcity'

Tipos:

```shell
assistantWorkspace='UUID'
assistantUsername='UUID'
assistantPassword='UUID'
assistantVersion='DATE'
mongoURL='HTTP'
mongoDbName='TEXT'
nluVersion='DATE'
nluURL='HTTP'
nluUsername='UUID'
nluPasword='UUID'
mctyBASEURL='HTTP'
mctyUser='TEXT'
mctyPassword='TEXT'
```


### Executando o código local

Para executar o código localmente além de instalar o NodeJS version 8.11.1 são necessárias que as variáveis de ambiente estejam presentes no código.
Crie um arquivo intitulado ".env" na pasta raiz do projeto com a seguinte estrutura:

```shell
assistantWorkspace=''
assistantUsername=''
assistantPassword=''
assistantVersion=''
mongoURL=''
mongoDbName=''
nluVersion=''
nluURL=''
nluUsername=''
nluPasword=''
mctyBASEURL=''
mctyUser=''
mctyPassword=''
```
Preencha com os valores das variáveis que estão no Bluemix. Ao executar a aplicação as variáveis estarão disponíveis.
Isso fará com que as variáveis fiquem visíveis para a aplicação.

### Execução da aplicação

```shell
npm install
npm start
```


