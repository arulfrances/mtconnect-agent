   // In charge of sniffing network and pulling devices into the db
const co = require('co')
const config = require('./config/config')
const through = require('through')
const { descriptionXML, deviceXML } = require('./utils')
const Finder = require('./finder')
const lokijs = require('./lokijs')
const log = require('./config/logger')
const common = require('./common')
const devices = require('./store')
const { urnSearch, deviceSearchInterval, path } = config.app.agent
const query = `urn:schemas-mtconnect-org:service:${urnSearch}`
const finder = new Finder({ query, frequency: deviceSearchInterval })
const request = require('request')

/**
  * processSHDR() process SHDR string
  *
  * @param {Object} data
  *
  * return uuid
  *
  */
function processSHDR (uuid) {
  return through((data) => {
    log.debug(data.toString())
    const stirng = String(data).trim()
    common.parsing(stirng, uuid)
  })
}

/**
  * connectToDevice() create socket connection to device
  *
  * @param {Object} address
  * @param {Object} port
  *
  * return uuid
  *
  */

function connectToDevice ({ ip, port, uuid }) {
  const response = request(`http://${ip}:${port}`)
  response.pipe(processSHDR(uuid))
  response.on('error', (err) => { // Remove device
    if (err.errno !== 'ECONNREFUSED') return
    const found = devices.find({ $and: [{ address: err.address }, { port: err.port }] })
    if (found.length > 0) devices.remove(found)
  })

  response.on('close', () => { // Remove device
    const found = devices.find({ $and: [{ address: ip }, { port }] })
    if (found.length > 0) { devices.remove(found) }
    log.debug('Connection closed')
  })

  devices.insert({ address: ip, port, uuid })
}

/**
  * addDevice()
  *
  * @param {String} hostname
  * @param {Number} portNumber
  * @param {String} uuid
  *
  * returns null
  */
function handleDevice ({ ip, port, uuid }) {
  return function addDevice (xml) {
    if (!common.mtConnectValidate(xml)) return
    if (lokijs.updateSchemaCollection(xml)) return
    const found = devices.find({ $and: [{ hostname: ip }, { port }] })
    const uuidFound = common.duplicateUuidCheck(uuid, devices)
    if ((found.length < 1) && (uuidFound.length < 1)) {
      connectToDevice({ ip, port, uuid })
    }
  }
}

function validateXML(schema){
  return new Promise((resolve, reject) => {
    if(common.mtConnectValidate(schema)){
      resolve(schema)
    } else {
      reject('Not valid XML')
    }  
  }) 
}  


function addSchema(schema){
  return new Promise((resolve, reject) => {
    const [ip, port] = lokijs.updateSchemaCollection(schema)
    
    if(ip && port){
      resolve([ip, port])
    } else {
      reject('Something went wrong at lokijs.updateSchemaCollection')
    }
  })
}

function onDevice (info) {
  co(descriptionXML(info)).then(function(xml){
    return co(deviceXML(xml))
  }).then(validateXML).then(function(xml){
    console.log('Done!!!!')
  }).catch(function(error){
    console.log(error)
  })
}

finder.on('device', onDevice)

module.exports = finder
