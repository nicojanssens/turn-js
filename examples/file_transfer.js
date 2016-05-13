'use strict'

var fs = require('fs')
var path = require('path')
var transports = require('stun-js').transports
var turn = require('../index')

var argv = require('yargs')
  .usage('Usage: $0 [params]')
  .demand('f')
  .alias('f', 'file')
  .nargs('f', 1)
  .describe('f', 'file to transmit via TURN server')
  .demand('a')
  .alias('a', 'addr')
  .nargs('a', 1)
  .describe('a', 'TURN server address')
  .demand('p')
  .alias('p', 'port')
  .nargs('p', 1)
  .describe('p', 'TURN server port')
  .alias('u', 'user')
  .nargs('u', 1)
  .describe('u', 'TURN server user account')
  .alias('w', 'pwd')
  .nargs('w', 1)
  .describe('w', 'TURN server user password')
  .alias('t', 'transport')
  .choices('t', ['tcp', 'udp'])
  .default('t', 'udp')
  .nargs('t', 1)
  .describe('t', 'Transport protocol')
  .help('h')
  .alias('h', 'help')
  .argv

  var clientAlice, clientBob
  if (argv.transport === 'udp') {
    clientAlice = turn(argv.addr, argv.port, argv.user, argv.pwd)
    clientBob = turn(argv.addr, argv.port, argv.user, argv.pwd)
  } else {
    var transportAlice = new transports.TCP()
    clientAlice = turn(argv.addr, argv.port, argv.user, argv.pwd, transportAlice)
    var transportBob = new transports.TCP()
    clientBob = turn(argv.addr, argv.port, argv.user, argv.pwd, transportBob)
  }
  var srflxAddressAlice, srflxAddressBob, relayAddressAlice, relayAddressBob
  var channelAlice, channelBob

  var startMessageType = 0x00
  var dataMessageType = 0x01
  var endMessageType = 0x10

  var writeStream

  // incoming messages
  clientBob.on('relayed-message', function (bytes, peerAddress) {
    console.log('bob received ' + bytes.length + ' byte(s) from alice')
    var type = bytes.slice(0, 1).readUInt8()
    var data = bytes.slice(1, bytes.length)
    switch(type) {
      case startMessageType:
        var filename = 'copy.' + data.toString()
        writeStream = fs.createWriteStream(filename)
        break
      case dataMessageType:
        writeStream.write(data, 'binary')
        break
      case endMessageType:
        writeStream.end()
        process.exit(0)
        break
      default:
        console.error("Add dazed and confused, don't know how to process message type " + type)
    }
  })


  // allocate session alice
  clientAlice.allocateP()
    .then(function (allocateAddress) {
      srflxAddressAlice = allocateAddress.mappedAddress
      relayAddressAlice = allocateAddress.relayedAddress
      console.log("alice's srflx address = " + srflxAddressAlice.address + ':' + srflxAddressAlice.port)
      console.log("alice's relay address = " + relayAddressAlice.address + ':' + relayAddressAlice.port)
      // allocate session bob
      return clientBob.allocateP()
    })
    .then(function (allocateAddress) {
      srflxAddressBob = allocateAddress.mappedAddress
      relayAddressBob = allocateAddress.relayedAddress
      console.log("bob's address = " + srflxAddressBob.address + ':' + srflxAddressBob.port)
      console.log("bob's relay address = " + relayAddressBob.address + ':' + relayAddressBob.port)
      // create permission for alice to send messages to bob
      return clientBob.createPermissionP(relayAddressAlice.address)
    })
    .then(function () {
      //  create permission for bob to send messages to alice
      return clientAlice.createPermissionP(relayAddressBob.address)
    })
    .then(function () {
      // create channel from alice to bob
      return clientAlice.bindChannelP(relayAddressBob.address, relayAddressBob.port)
    })
    .then(function (channel) {
      channelBob = channel
      console.log("alice's channel to bob = " + channelBob)
      // create channel from bob to alice
      return clientBob.bindChannelP(relayAddressAlice.address, relayAddressAlice.port)
    })
    .then(function (channel) {
      channelAlice = channel
      console.log("bob's channel to alice = " + channelAlice)
      // send filename from alice to bob
      var filename = path.basename(argv.file)
      console.log('alice sends filename ' + filename + ' to bob')
      var typeByte = new Buffer(1)
      typeByte.writeUInt8(startMessageType)
      var filenameBytes = new Buffer(filename)
      var bytes = Buffer.concat([typeByte, filenameBytes])
      return clientAlice.sendToChannelP(bytes, channelBob)
    })
    .then(function () {
      // if tcp -> max length channel data buffer is 65535, and we need one type byte
      // if udp -> EMSGSIZE error when buffer > 9212
      var bufferSize = argv.transport === 'tcp' ? 65534 : 9211
      // create file readstream and send chunks
      var readStream = fs.createReadStream(argv.file, { highWaterMark: bufferSize })
      readStream.on('data', function (chunk) {
        var typeByte = new Buffer(1)
        typeByte.writeUInt8(dataMessageType)
        var bytes = Buffer.concat([typeByte, chunk])
        readStream.pause()
        clientAlice.sendToChannel(
          bytes,
          channelBob,
          function () { // on success
            console.log('alice sent chunk of ' + chunk.length + ' bytes to bob')
            readStream.resume()
          },
          function (error) { // on failure
            console.error(error)
          }
        )
      })
      readStream.on('end', function () {
        // send end message
        var typeByte = new Buffer(1)
        typeByte.writeUInt8(endMessageType)
        clientAlice.sendToChannel(
          typeByte,
          channelBob,
          function () { // on success
            console.log('alice sent end message to bob')
          },
          function (error) { // on failure
            console.error(error)
          }
        )
      })
    })
