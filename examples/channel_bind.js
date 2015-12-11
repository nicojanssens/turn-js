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

var clientAlice = turn.init(argv.addr, argv.port, argv.user, argv.pwd)
var clientBob = turn.init(argv.addr, argv.port, argv.user, argv.pwd)
var srflxAddressAlice, srflxAddressBob, relayAddressAlice, relayAddressBob
var channelAlice, channelBob

var testQuestion = 'What is the meaning of life?'
var testAnswer = 'A movie.'
var testRuns = 10
var messagesSent = 0

var sendRequest = function (onReady) {
  clientAlice.sendChannelData(channelBob, testQuestion, function (error) {
    if (error) {
      winston.error(error)
      return
    }
    winston.info('question sent from alice to bob')
    if (onReady) {
      onReady()
    }
  })
}

var sendReply = function () {
  clientBob.sendChannelData(channelAlice, testAnswer, function (error) {
    if (error) {
      winston.error(error)
      return
    }
    winston.info('response sent from bob to alice')
  })
}

clientAlice.on('data', function (data, peerAddress) {
  winston.info('alice received response: ' + data)
  if (messagesSent === testRuns) {
    clientAlice.closeP()
      .then(function () {
        return clientBob.closeP()
      })
      .then(function () {
        winston.info("that's all folks")
      })
  } else {
    sendRequest(function () {
      messagesSent++
    })
  }
})

clientBob.on('data', function (data, peerAddress) {
  winston.info('bob received question: ' + data)
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
    // create channel from bob to alice
    return clientBob.bindChannelP(relayAddressAlice.address, relayAddressAlice.port)
  })
  .then(function (channel) {
    channelAlice = channel
    // send test message
    sendRequest(function () {
      messagesSent++
    })
  })
