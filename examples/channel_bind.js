'use strict'

var turn = require('../index')
var winston = require('winston')

var argv = require('yargs')
  .usage('Usage: $0 [params]')
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
  .default('l', 'debug')
  .choices('l', ['info', 'debug', 'warn', 'error', 'verbose', 'silly'])
  .alias('l', 'log')
  .nargs('l', 1)
  .describe('l', 'Log level')
  .help('h')
  .alias('h', 'help')
  .argv

winston.level = argv.log

var socketAlice = turn(argv.addr, argv.port, argv.user, argv.pwd)
var socketBob = turn(argv.addr, argv.port, argv.user, argv.pwd)
var srflxAddressAlice, srflxAddressBob, relayAddressAlice, relayAddressBob
var channelAlice, channelBob

var testQuestion = 'What is the meaning of life?'
var testAnswer = 'A movie.'
var testRuns = 10
var messagesSent = 0

var sendRequest = function (onSuccess) {
  var bytes = new Buffer(testQuestion)
  socketAlice.sendToChannel(
    bytes,
    channelBob,
    function () { // on success
      winston.info('question sent from alice to bob')
      if (onSuccess) {
        onSuccess()
      }
    },
    function (error) { // on error
      winston.error(error)
    }
  )
}

var sendReply = function () {
  var bytes = new Buffer(testAnswer)
  socketBob.sendToChannel(
    bytes,
    channelAlice,
    function () { // on success
      winston.info('response sent from bob to alice')
    },
    function (error) { // on failure
      winston.error(error)
    }
  )
}

socketAlice.on('relayed-message', function (bytes, peerAddress) {
  var message = bytes.toString()
  winston.info('alice received response ' + message + ' from ' + JSON.stringify(peerAddress))
  if (messagesSent === testRuns) {
    socketAlice.closeP()
      .then(function () {
        return socketBob.closeP()
      })
      .then(function () {
        winston.info("that's all folks")
        process.exit(0)
      })
  } else {
    sendRequest(function () {
      messagesSent++
    })
  }
})

socketBob.on('relayed-message', function (bytes, peerAddress) {
  var message = bytes.toString()
  winston.info('bob received question ' + message + ' from ' + JSON.stringify(peerAddress))
  sendReply()
})

// allocate session alice
socketAlice.allocateP()
  .then(function (allocateAddress) {
    srflxAddressAlice = allocateAddress.mappedAddress
    relayAddressAlice = allocateAddress.relayedAddress
    winston.debug("alice's srflx address = " + srflxAddressAlice.address + ':' + srflxAddressAlice.port)
    winston.debug("alice's relay address = " + relayAddressAlice.address + ':' + relayAddressAlice.port)
    // allocate session bob
    return socketBob.allocateP()
  })
  .then(function (allocateAddress) {
    srflxAddressBob = allocateAddress.mappedAddress
    relayAddressBob = allocateAddress.relayedAddress
    winston.debug("bob's address = " + srflxAddressBob.address + ':' + srflxAddressBob.port)
    winston.debug("bob's relay address = " + relayAddressBob.address + ':' + relayAddressBob.port)
    // create permission for alice to send messages to bob
    return socketBob.createPermissionP(relayAddressAlice.address)
  })
  .then(function () {
    //  create permission for bob to send messages to alice
    return socketAlice.createPermissionP(relayAddressBob.address)
  })
  .then(function () {
    // create channel from alice to bob
    return socketAlice.bindChannelP(relayAddressBob.address, relayAddressBob.port)
  })
  .then(function (channel) {
    channelBob = channel
    winston.debug("alice's channel to bob = " + channelBob)
    // create channel from bob to alice
    return socketBob.bindChannelP(relayAddressAlice.address, relayAddressAlice.port)
  })
  .then(function (channel) {
    channelAlice = channel
    winston.debug("bob's channel to alice = " + channelAlice)
    // send test message
    sendRequest(function () {
      messagesSent++
    })
  })
