'use strict'

var dgram = require('dgram')
var TurnClient = require('../src/turn_client')
var winston = require('winston')

var chai = require('chai')
var chaiAsPromised = require('chai-as-promised')
var expect = chai.expect
chai.use(chaiAsPromised)
chai.should()

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

var testAddr = argv.addr
var testPort = argv.port
var testUser = argv.user
var testPwd = argv.pwd
winston.level = argv.log

describe('#TURN operations', function () {
  this.timeout(5000)

  it('should execute TURN allocate operation (using promises)', function () {
    var client = new TurnClient(testAddr, testPort, testUser, testPwd)
    return client.allocateP()
      .then(function (result) {
        expect(result).not.to.be.undefined
        expect(result).to.have.property('mappedAddress')
        expect(result.mappedAddress).to.have.property('address')
        expect(result.mappedAddress).to.have.property('port')
        // expect(result.mappedAddress.address).to.equal(testGW)
        expect(result).to.have.property('relayedAddress')
        expect(result.relayedAddress).to.have.property('address')
        expect(result.relayedAddress).to.have.property('port')
        expect(result.relayedAddress.address).to.equal(testAddr)
        return client.closeP()
      })
  })

  it('should execute TURN allocate operation (using callbacks)', function (done) {
    var client = new TurnClient(testAddr, testPort, testUser, testPwd)

    var onError = function (error) {
      done(error)
    }

    var onReady = function (result) {
      expect(result).not.to.be.undefined
      expect(result).to.have.property('mappedAddress')
      expect(result.mappedAddress).to.have.property('address')
      expect(result.mappedAddress).to.have.property('port')
      // expect(result.mappedAddress.address).to.equal(testGW)
      expect(result).to.have.property('relayedAddress')
      expect(result.relayedAddress).to.have.property('address')
      expect(result.relayedAddress).to.have.property('port')
      expect(result.relayedAddress.address).to.equal(testAddr)
      client.close(
        function () {
          done()
        },
        onError
      )
    }

    client.allocate(onReady, onError)
  })

  it('should execute TURN allocate operation using a specified dgram client (using promises)', function () {
    var udpclient = dgram.createclient('udp4')
    var client = new TurnClient(testAddr, testPort, testUser, testPwd, udpclient)
    return client.allocateP()
      .then(function (result) {
        expect(result).not.to.be.undefined
        expect(result).to.have.property('mappedAddress')
        expect(result.mappedAddress).to.have.property('address')
        expect(result.mappedAddress).to.have.property('port')
        // expect(result.mappedAddress.address).to.equal(testGW)
        expect(result).to.have.property('relayedAddress')
        expect(result.relayedAddress).to.have.property('address')
        expect(result.relayedAddress).to.have.property('port')
        expect(result.relayedAddress.address).to.equal(testAddr)
        return client.closeP()
      })
  })

  it('should execute TURN allocate followed by refresh (using promises)', function () {
    var client = new TurnClient(testAddr, testPort, testUser, testPwd)
    var lifetime = 600
    return client.allocateP()
      .then(function (result) {
        return client.refreshP(lifetime)
      })
      .then(function (duration) {
        expect(duration).to.equal(lifetime)
        return client.closeP()
      })
  })

  it('should execute TURN allocate followed by create permission (using promises)', function () {
    var client = new TurnClient(testAddr, testPort, testUser, testPwd)
    var testAddress = '1.2.3.4'
    var lifetime = 600
    return client.allocateP()
      .then(function (result) {
        return client.createPermissionP(testAddress, lifetime)
      })
      .then(function () {
        return client.closeP()
      })
  })

  it('should receive messages that are sent via relay server', function (done) {
    var testData = 'hello there'
    var testRuns = 10
    var messagesReceived = 0

    var clientAlice = new TurnClient(testAddr, testPort, testUser, testPwd)
    var clientBob = new TurnClient(testAddr, testPort, testUser, testPwd)
    var srflxAddressAlice, srflxAddressBob, relayAddressAlice, relayAddressBob

    var sendTestMessageFromAliceToBob = function () {
      var bytes = new Buffer(testData)
      clientAlice.sendToRelay(
        bytes,
        relayAddressBob.address,
        relayAddressBob.port,
        function () {
          winston.debug('[turn-js] message sent to ' + relayAddressBob.address + ':' + relayAddressBob.port)
        }, // on success
        function (error) {
          done(error)
        }
      )
    }

    // subscribe to incoming messages
    clientBob.on('relayed-message', function (bytes, peerAddress) {
      var message = bytes.toString()
      expect(message).to.equal(testData)
      winston.debug('[turn-js] receiving test message ' + message)
      messagesReceived++
      if (messagesReceived === testRuns) {
        clientBob.closeP()
          .then(function () {
            return clientAlice.closeP()
          })
          .then(function () {
            done()
          })
      } else {
        sendTestMessageFromAliceToBob()
      }
    })

    // allocate relaying session for alice
    clientAlice.allocateP()
      .then(function (allocateAddress) {
        srflxAddressAlice = allocateAddress.mappedAddress
        relayAddressAlice = allocateAddress.relayedAddress
        winston.debug("[turn-js] alice's srflx address = " + srflxAddressAlice.address + ':' + srflxAddressAlice.port)
        winston.debug("[turn-js] alice's relay address = " + relayAddressAlice.address + ':' + relayAddressAlice.port)
        // allocate relaying session for bob
        return clientBob.allocateP()
      })
      .then(function (allocateAddress) {
        srflxAddressBob = allocateAddress.mappedAddress
        relayAddressBob = allocateAddress.relayedAddress
        winston.debug("[turn-js] bob's address = " + srflxAddressBob.address + ':' + srflxAddressBob.port)
        winston.debug("[turn-js] bob's relay address = " + relayAddressBob.address + ':' + relayAddressBob.port)
        // create permission for alice to send messages to bob
        return clientBob.createPermissionP(relayAddressAlice.address)
      })
      .then(function () {
        // create permission for bob to send messages to alice
        return clientAlice.createPermissionP(relayAddressBob.address)
      })
      .then(function () {
        // send test message
        sendTestMessageFromAliceToBob()
      })
  })

  it('should execute TURN channel binding and receive messages sent via these channels (using promises)', function (done) {
    var testData = 'hello there'
    var testRuns = 10
    var messagesReceived = 0

    var clientAlice = new TurnClient(testAddr, testPort, testUser, testPwd)
    var clientBob = new TurnClient(testAddr, testPort, testUser, testPwd)
    var srflxAddressAlice, srflxAddressBob, relayAddressAlice, relayAddressBob
    var channelId

    var sendTestMessageFromAliceToBob = function () {
      var bytes = new Buffer(testData)
      clientAlice.sendToChannel(
        bytes,
        channelId,
        function () {
          winston.debug('[turn-js] message sent to channel ' + channelId)
        },
        function (error) {
          done(error)
        }
      )
    }

    // subscribe to incoming messages
    clientBob.on('relayed-message', function (bytes, peerAddress) {
      var message = bytes.toString()
      expect(message).to.equal(testData)
      winston.debug('[turn-js] receiving test message ' + message)
      messagesReceived++
      if (messagesReceived === testRuns) {
        clientBob.closeP()
          .then(function () {
            return clientAlice.closeP()
          })
          .then(function () {
            done()
          })
      } else {
        sendTestMessageFromAliceToBob()
      }
    })

    // allocate relaying session for alice
    clientAlice.allocateP()
      .then(function (allocateAddress) {
        srflxAddressAlice = allocateAddress.mappedAddress
        relayAddressAlice = allocateAddress.relayedAddress
        winston.debug("[turn-js] alice's srflx address = " + srflxAddressAlice.address + ':' + srflxAddressAlice.port)
        winston.debug("[turn-js] alice's relay address = " + relayAddressAlice.address + ':' + relayAddressAlice.port)
        // allocate relaying session for bob
        return clientBob.allocateP()
      })
      .then(function (allocateAddress) {
        srflxAddressBob = allocateAddress.mappedAddress
        relayAddressBob = allocateAddress.relayedAddress
        winston.debug("[turn-js] bob's address = " + srflxAddressBob.address + ':' + srflxAddressBob.port)
        winston.debug("[turn-js] bob's relay address = " + relayAddressBob.address + ':' + relayAddressBob.port)
        // create permission for alice to send messages to bob
        return clientBob.createPermissionP(relayAddressAlice.address)
      })
      .then(function () {
        // create channel from alice to bob
        return clientAlice.bindChannelP(relayAddressBob.address, relayAddressBob.port)
      })
      .then(function (channel) {
        expect(channel).not.to.be.undefined
        channelId = channel
        //  create permission for bob to send messages to alice
        return clientAlice.createPermissionP(relayAddressBob.address)
      })
      .then(function () {
        // create channel from bob to alice
        return clientBob.bindChannelP(relayAddressAlice.address, relayAddressAlice.port)
      })
      .then(function (anotherChannel) {
        // send test message
        sendTestMessageFromAliceToBob()
      })
  })
})
