const log    = require('./config/logger');
const init   = require('./init');
const Client = require('node-ssdp').Client // Control Point
const loki   = require('lokijs');
const util   = require('util');
const net    = require('net');

var agent = new Client();

var db = new loki('agent-loki.json')
var devices = db.addCollection('devices');

// TODO Global list of active sockets

agent.on('response', function inResponse(headers, code, rinfo) {
    // TODO Handle CACHE-CONTROL

    var headerData = JSON.stringify(headers, null, '  ');
    var data = JSON.parse(headerData);
    var location = data['LOCATION'].split(':');

    var found = devices.find( {'address': location[0], 'port': location[1]} );

    var insert = (found == false) ? devices.insert( { "address" : location[0], "port" : location[1] } ) : false ;
});

// Search for interested devices
setInterval(function() {
    agent.search('urn:schemas-upnp-org:service:VMC-3Axis:1');
}, 10000);

// TODO For each device in lokijs, create a socket and connect to it.
// Search for interested devices
setInterval(function() {
    var activeDevices = devices.find({});

    log.debug(util.inspect(activeDevices));

    for (var obj of activeDevices) {
        var client = new net.Socket();

        client.connect(obj.port, obj.address, function() {
            console.log('Connected.');
        });

        client.on('data', function(data) {
	    console.log('Received: ' + data);
        });

        client.on('close', function() {
	    console.log('Connection closed');
        });
    }
}, 30000);
