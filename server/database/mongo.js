const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');
const Q = require('q');

// Connection URL
const url = process.env.mongoURL;


// Database Name
const dbName = process.env.mongoDbName

async function connect(option, id, data) {

    MongoClient.connect(url, { useNewUrlParser: true }, async function (err, client) {
        assert.equal(null, err);
        const mongo = client.db(dbName);

        switch (option) {
            case 'insert':
                var myObj = { _id: id, context: data };
                mongo.collection("context").insertOne(myObj, function (err, res) {
                    if (err) throw err;
                });
                break;

            case 'delete':
                var myquery = { _id: id };
                mongo.collection("context").deleteOne(myquery, function (err, obj) {
                    if (err) throw err;
                });
                break;
        }
        client.close();
    });

}

module.exports = {

    insert: async function (id, data) {
        await connect('insert', id, data);
    },
    update: async function (id, data) {

        var deferred = Q.defer();
        MongoClient.connect(url, { useNewUrlParser: true }, async function (err, client) {
            assert.equal(null, err);
            const mongo = client.db(dbName);

            var myquery = { _id: id };
            var newvalues = { $set: { context: data } };
            await mongo.collection("context").updateOne(myquery, newvalues, function (err, res) {
                if (err) throw err;
                deferred.resolve(res);
            });
            client.close();
        });

        return deferred.promise;
    },
    find: async function (id) {

        var deferred = Q.defer();
        MongoClient.connect(url, { useNewUrlParser: true }, async function (err, client) {
            assert.equal(null, err);
            const mongo = client.db(dbName);

            var query = { _id: id };
            mongo.collection("context").find(query).toArray(async function (err, result) {
                if (err) throw err;
                if (result.length > 0)
                    deferred.resolve(result[0].context);
            });
            client.close();
        });

        return deferred.promise;
    },
    delete: async function (id) {
        await connect('delete', id);
    }
};