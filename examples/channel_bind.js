'use strict'

var transports = require('stun-js').transports
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
  .alias('t', 'transport')
  .choices('t', ['tcp', 'udp'])
  .default('t', 'udp')
  .nargs('t', 1)
  .describe('t', 'Transport protocol')
  .alias('l', 'log')
  .choices('l', ['info', 'debug', 'warn', 'error', 'verbose', 'silly'])
  .default('l', 'debug')
  .nargs('l', 1)
  .describe('l', 'Log level')
  .help('h')
  .alias('h', 'help')
  .argv

winston.level = argv.log

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

var testQuestion = 'What is the meaning of life?'
var testAnswer = 'A movie.'
var testRuns = 10
var messagesSent = 0

var sendRequest = function (onSuccess) {
  var bytes = new Buffer(testQuestion)
  clientAlice.sendToChannel(
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
  clientBob.sendToChannel(
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

clientAlice.on('relayed-message', function (bytes, peerAddress) {
  var message = bytes.toString()
  winston.info('alice received response ' + message + ' from ' + JSON.stringify(peerAddress))
  if (messagesSent === testRuns) {
    clientAlice.closeP()
      .then(function () {
        return clientBob.closeP()
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

clientBob.on('relayed-message', function (bytes, peerAddress) {
  var message = bytes.toString()
  winston.info('bob received question ' + message + ' from ' + JSON.stringify(peerAddress))
  sendReply()
})

// allocate session alice
clientAlice.allocateP()
  .then(function (allocateAddress) {
    srflxAddressAlice = allocateAddress.mappedAddress
    relayAddressAlice = allocateAddress.relayedAddress
    winston.debug("alice's srflx address = " + srflxAddressAlice.address + ':' + srflxAddressAlice.port)
    winston.debug("alice's relay address = " + relayAddressAlice.address + ':' + relayAddressAlice.port)
    // allocate session bob
    return clientBob.allocateP()
  })
  .then(function (allocateAddress) {
    srflxAddressBob = allocateAddress.mappedAddress
    relayAddressBob = allocateAddress.relayedAddress
    winston.debug("bob's address = " + srflxAddressBob.address + ':' + srflxAddressBob.port)
    winston.debug("bob's relay address = " + relayAddressBob.address + ':' + relayAddressBob.port)
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
    winston.debug("alice's channel to bob = " + channelBob)
    // create channel from bob to alice
    return clientBob.bindChannelP(relayAddressAlice.address, relayAddressAlice.port)
  })
  .then(function (channel) {
    channelAlice = channel
    winston.debug("bob's channel to alice = " + channelAlice)
    // send test message
    sendRequest(function () {
      messagesSent++
    })
  })
