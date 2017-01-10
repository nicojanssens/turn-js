'use strict'

var transports = require('stun-js').transports
var turn = require('../index')

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

var testQuestion = 'What is the meaning of life?'
var testAnswer = 'A movie.'
var testRuns = 10
var messagesSent = 0

var sendRequest = function (onSuccess) {
  var bytes = new Buffer(testQuestion)
  clientAlice.sendToRelay(
    bytes,
    relayAddressBob.address,
    relayAddressBob.port,
    function () { // on success
      console.log('question sent from alice to bob')
      if (onSuccess) {
        onSuccess()
      }
    },
    function (error) { // on failure
      console.error(error)
    }
  )
}

var sendReply = function () {
  var bytes = new Buffer(testAnswer)
  clientBob.sendToRelay(
    bytes,
    relayAddressAlice.address,
    relayAddressAlice.port,
    function () {
      console.log('response sent from bob to alice')
    },
    function (error) {
      console.error(error)
    }
  )
}

clientAlice.on('relayed-message', function (bytes, peerAddress) {
  var message = bytes.toString()
  console.log('alice received response: ' + message)
  if (messagesSent === testRuns) {
    clientAlice.closeP()
      .then(function () {
        return clientBob.closeP()
      })
      .then(function () {
        console.log("that's all folks")
        process.exit(0)
      })
      .catch(function (error) {
        console.log('ERROR: ' + error)
      })
  } else {
    sendRequest(function () {
      messagesSent++
    })
  }
})

clientBob.on('relayed-message', function (bytes, peerAddress) {
  var message = bytes.toString()
  console.log('bob received question: ' + message)
  sendReply()
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
    // create permission for bob to send messages to alice
    return clientAlice.createPermissionP(relayAddressBob.address)
  })
  .then(function () {
    // send request
    sendRequest(function () {
      messagesSent++
    })
  })
