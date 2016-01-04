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

var testQuestion = 'What is the meaning of life?'
var testAnswer = 'A movie.'
var testRuns = 10
var messagesSent = 0

var sendRequest = function (onSuccess) {
  var bytes = new Buffer(testQuestion)
  socketAlice.sendToRelay(
    bytes,
    relayAddressBob.address,
    relayAddressBob.port,
    function () { // on success
      winston.info('question sent from alice to bob')
      if (onSuccess) {
        onSuccess()
      }
    },
    function (error) { // on failure
      winston.error(error)
    }
  )
}

var sendReply = function () {
  var bytes = new Buffer(testAnswer)
  socketBob.sendToRelay(
    bytes,
    relayAddressAlice.address,
    relayAddressAlice.port,
    function () {
      winston.info('response sent from bob to alice')
    },
    function (error) {
      winston.error(error)
    }
  )
}

socketAlice.on('relayed-message', function (bytes, peerAddress) {
  var message = bytes.toString()
  winston.info('alice received response: ' + message)
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
  winston.info('bob received question: ' + message)
  sendReply()
})

// allocate session alice
socketAlice.allocateP()
  .then(function (allocateAddress) {
    srflxAddressAlice = allocateAddress.mappedAddress
    relayAddressAlice = allocateAddress.relayedAddress
    winston.info("alice's srflx address = " + srflxAddressAlice.address + ':' + srflxAddressAlice.port)
    winston.info("alice's relay address = " + relayAddressAlice.address + ':' + relayAddressAlice.port)
    // allocate session bob
    return socketBob.allocateP()
  })
  .then(function (allocateAddress) {
    srflxAddressBob = allocateAddress.mappedAddress
    relayAddressBob = allocateAddress.relayedAddress
    winston.info("bob's address = " + srflxAddressBob.address + ':' + srflxAddressBob.port)
    winston.info("bob's relay address = " + relayAddressBob.address + ':' + relayAddressBob.port)
    // create permission for alice to send messages to bob
    return socketBob.createPermissionP(relayAddressAlice.address)
  })
  .then(function () {
    // create permission for bob to send messages to alice
    return socketAlice.createPermissionP(relayAddressBob.address)
  })
  .then(function () {
    // send request
    sendRequest(function () {
      messagesSent++
    })
  })
