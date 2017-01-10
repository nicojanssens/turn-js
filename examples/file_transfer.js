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
  .boolean('l')
  .describe('l', 'verbose logging')
  .alias('l', 'log')
  .help('h')
  .alias('h', 'help')
  .argv

var clientAlice = turn(argv.addr, argv.port, argv.user, argv.pwd, new transports.TCP())
var clientBob = turn(argv.addr, argv.port, argv.user, argv.pwd, new transports.TCP())
var clientAliceClosed = false
var clientBobClosed = false

var srflxAddressAlice, srflxAddressBob, relayAddressAlice, relayAddressBob
var channelAlice, channelBob

var startMessageType = 0x00
var dataMessageType = 0x01
var endMessageType = 0x10

var readStream, writeStream

var chunkNb = 0
var expSeqNb = 0

// incoming messages
clientBob.on('relayed-message', function (bytes, peerAddress) {
  if (argv.log) {
    console.log('bob received ' + bytes.length + ' byte(s) from alice')
  }
  var type = bytes.slice(0, 1).readUInt8(0)
  switch (type) {
    case startMessageType:
      var filenameBytes = bytes.slice(1, bytes.length)
      var filename = 'copy.' + filenameBytes.toString()
      writeStream = fs.createWriteStream(filename)
      break
    case dataMessageType:
      var seqNbBytes = bytes.slice(1, 3)
      var seqNb = seqNbBytes.readUInt16BE(0)
      if (seqNb === expSeqNb) {
        expSeqNb++
      } else {
        console.error('Woops, expected chunk ' + expSeqNb + ', instead received ' + seqNb)
        expSeqNb = seqNb + 1
        process.exit(0)
      }
      readStream.resume()
      var data = bytes.slice(3, bytes.length)
      writeStream.write(data, 'binary')
      break
    case endMessageType:
      writeStream.end()
      clientBob.closeP()
        .then(function () {
          console.log("bob's client is closed")
          clientBobClosed = true
          if (clientAliceClosed && clientBobClosed) {
            process.exit(0)
          }
        })
      break
    default:
      console.error("Add dazed and confused, don't know how to process message type " + type)
  }
})

// init alice and bob's client + allocate session alice
clientBob.initP()
  .then(function () {
    return clientAlice.initP()
  })
  .then(function () {
    return clientAlice.allocateP()
  })
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
    if (argv.log) {
      console.log('alice sends filename ' + filename + ' to bob')
    }
    var typeByte = new Buffer(1)
    typeByte.writeUInt8(startMessageType)
    var filenameBytes = new Buffer(filename)
    var bytes = Buffer.concat([typeByte, filenameBytes])
    return clientAlice.sendToChannelP(bytes, channelBob)
  })
  .then(function () {
    var bufferSize = 16384 - 1 - 2 - 4 // buffer size - type byte - seqnb bytes - channeldata header
    // create file readstream and send chunks
    readStream = fs.createReadStream(argv.file, { highWaterMark: bufferSize })
    readStream.on('data', function (chunk) {
      var typeByte = new Buffer(1)
      typeByte.writeUInt8(dataMessageType)
      var seqNbBytes = new Buffer(2)
      seqNbBytes.writeUInt16BE(chunkNb)
      var bytes = Buffer.concat([typeByte, seqNbBytes, chunk])
      readStream.pause()
      clientAlice.sendToChannel(
        bytes,
        channelBob,
        function () { // on success
          if (argv.log) {
            console.log('alice sent chunk of ' + bytes.length + ' bytes to bob')
          }
          chunkNb++
        // readStream.resume()
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
      clientAlice.sendToChannelP(typeByte, channelBob)
        .then(function () {
          if (argv.log) {
            console.log('alice sent end message to bob')
          }
          return clientAlice.closeP()
        })
        .then(function () {
          console.log("alice's client is closed")
          clientAliceClosed = true
          if (clientAliceClosed && clientBobClosed) {
            process.exit(0)
          }
        })
        .catch(function (error) {
          console.error(error)
        })
    })
  })
