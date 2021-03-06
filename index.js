var soap = require('soap')
    , deepVal = require('deepval')
    ;

module.exports = ChannelAdvisor;

ChannelAdvisor.endpoints = require('./endpoints.js');

function ChannelAdvisor (options) {
    var self = this;

    if (!(self instanceof ChannelAdvisor)) {
        return new ChannelAdvisor(options);
    }

    self.options = options;
    self.clientPool = {};

    Object.keys(ChannelAdvisor.endpoints).forEach(function(endpointName) {
        var endpoint = ChannelAdvisor.endpoints[endpointName];

        var ep = self[endpointName] = {};

        Object.keys(endpoint.methods).forEach(function (methodName) {
            var methodPath = endpoint.methods[methodName];

            ep[methodName] = function (args, cb) {
                if (!cb) {
                    cb = args;
                    args = null;
                }

                self.getClient(endpointName, function (err, client) {
                    var fn = deepVal(client, methodPath);
                    
                    if (!fn) {
                        return cb(new Error("SOAP method does not exist for " + methodPath));
                    }

                    var argArray = [];

                    if (args) {
                        argArray.push(args);
                    }

                    argArray.push(function (err, data) {
                        ep[methodName].lastRequest = client.lastRequest;
                        ep[methodName].lastRequestHeaders = client.lastRequestHeaders;
                        ep[methodName].lastRequestLocation = client.lastRequestLocation;
                        ep[methodName].lastResponse = client.lastResponse;
                        ep[methodName].lastResponseHeaders = client.lastResponseHeaders;

                        if (err) {
                            //pass the client's lastRequest along with the err object
                            err.lastRequest = client.lastRequest;
                            return cb(err, null);
                        }
            

                        if (data && data[methodName + 'Result']) {
                            data = data[methodName + 'Result'];
                        }

                        return cb(err, data);
                    });

                    fn.apply(client, argArray);
                });
            };
        });
    });
}

ChannelAdvisor.prototype.getClient = function (endpointName, cb) {
    var self = this;

    if (self.clientPool[endpointName]) {
        return cb(null, self.clientPool[endpointName]);
    }

    var endpoint = ChannelAdvisor.endpoints[endpointName];

    soap.createClient(
        endpoint.wsdl
        , function (err, client) {
            if (err) {
                return cb(err, client);
            }

            client.addSoapHeader({
                APICredentials : {
                    DeveloperKey : self.options.developerKey
                    , Password : self.options.password
                }
            }, '', 'tns', 'http://api.channeladvisor.com/webservices/');

            return cb(err, client);
        }
        , endpoint.url
    );
}

