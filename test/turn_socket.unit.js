'use strict'

var dgram = require('dgram')
var TurnSocket = require('../src/turn_socket')
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
    var socket = new TurnSocket(testAddr, testPort, testUser, testPwd)
    return socket.allocateP()
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
        return socket.closeP()
      })
  })

  it('should execute TURN allocate operation (using callbacks)', function (done) {
    var socket = new TurnSocket(testAddr, testPort, testUser, testPwd)

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
      socket.close(
        function () {
          done()
        },
        onError
      )
    }

    socket.allocate(onReady, onError)
  })

  it('should execute TURN allocate operation using a specified dgram socket (using promises)', function () {
    var udpSocket = dgram.createSocket('udp4')
    var socket = new TurnSocket(testAddr, testPort, testUser, testPwd, udpSocket)
    return socket.allocateP()
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
        return socket.closeP()
      })
  })

  it('should execute TURN allocate followed by refresh (using promises)', function () {
    var socket = new TurnSocket(testAddr, testPort, testUser, testPwd)
    var lifetime = 600
    return socket.allocateP()
      .then(function (result) {
        return socket.refreshP(lifetime)
      })
      .then(function (duration) {
        expect(duration).to.equal(lifetime)
        return socket.closeP()
      })
  })

  it('should execute TURN allocate followed by create permission (using promises)', function () {
    var socket = new TurnSocket(testAddr, testPort, testUser, testPwd)
    var testAddress = '1.2.3.4'
    var lifetime = 600
    return socket.allocateP()
      .then(function (result) {
        return socket.createPermissionP(testAddress, lifetime)
      })
      .then(function () {
        return socket.closeP()
      })
  })

  it('should receive messages that are sent via relay server', function (done) {
    var testData = 'hello there'
    var testRuns = 10
    var messagesReceived = 0

    var socketAlice = new TurnSocket(testAddr, testPort, testUser, testPwd)
    var socketBob = new TurnSocket(testAddr, testPort, testUser, testPwd)
    var srflxAddressAlice, srflxAddressBob, relayAddressAlice, relayAddressBob

    var sendTestMessageFromAliceToBob = function () {
      var bytes = new Buffer(testData)
      socketAlice.sendToRelay(
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
    socketBob.on('relayed-message', function (bytes, peerAddress) {
      var message = bytes.toString()
      expect(message).to.equal(testData)
      winston.debug('[turn-js] receiving test message ' + message)
      messagesReceived++
      if (messagesReceived === testRuns) {
        socketBob.closeP()
          .then(function () {
            return socketAlice.closeP()
          })
          .then(function () {
            done()
          })
      } else {
        sendTestMessageFromAliceToBob()
      }
    })

    // allocate relaying session for alice
    socketAlice.allocateP()
      .then(function (allocateAddress) {
        srflxAddressAlice = allocateAddress.mappedAddress
        relayAddressAlice = allocateAddress.relayedAddress
        winston.debug("[turn-js] alice's srflx address = " + srflxAddressAlice.address + ':' + srflxAddressAlice.port)
        winston.debug("[turn-js] alice's relay address = " + relayAddressAlice.address + ':' + relayAddressAlice.port)
        // allocate relaying session for bob
        return socketBob.allocateP()
      })
      .then(function (allocateAddress) {
        srflxAddressBob = allocateAddress.mappedAddress
        relayAddressBob = allocateAddress.relayedAddress
        winston.debug("[turn-js] bob's address = " + srflxAddressBob.address + ':' + srflxAddressBob.port)
        winston.debug("[turn-js] bob's relay address = " + relayAddressBob.address + ':' + relayAddressBob.port)
        // create permission for alice to send messages to bob
        return socketBob.createPermissionP(relayAddressAlice.address)
      })
      .then(function () {
        // create permission for bob to send messages to alice
        return socketAlice.createPermissionP(relayAddressBob.address)
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

    var socketAlice = new TurnSocket(testAddr, testPort, testUser, testPwd)
    var socketBob = new TurnSocket(testAddr, testPort, testUser, testPwd)
    var srflxAddressAlice, srflxAddressBob, relayAddressAlice, relayAddressBob
    var channelId

    var sendTestMessageFromAliceToBob = function () {
      var bytes = new Buffer(testData)
      socketAlice.sendToChannel(
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
    socketBob.on('relayed-message', function (bytes, peerAddress) {
      var message = bytes.toString()
      expect(message).to.equal(testData)
      winston.debug('[turn-js] receiving test message ' + message)
      messagesReceived++
      if (messagesReceived === testRuns) {
        socketBob.closeP()
          .then(function () {
            return socketAlice.closeP()
          })
          .then(function () {
            done()
          })
      } else {
        sendTestMessageFromAliceToBob()
      }
    })

    // allocate relaying session for alice
    socketAlice.allocateP()
      .then(function (allocateAddress) {
        srflxAddressAlice = allocateAddress.mappedAddress
        relayAddressAlice = allocateAddress.relayedAddress
        winston.debug("[turn-js] alice's srflx address = " + srflxAddressAlice.address + ':' + srflxAddressAlice.port)
        winston.debug("[turn-js] alice's relay address = " + relayAddressAlice.address + ':' + relayAddressAlice.port)
        // allocate relaying session for bob
        return socketBob.allocateP()
      })
      .then(function (allocateAddress) {
        srflxAddressBob = allocateAddress.mappedAddress
        relayAddressBob = allocateAddress.relayedAddress
        winston.debug("[turn-js] bob's address = " + srflxAddressBob.address + ':' + srflxAddressBob.port)
        winston.debug("[turn-js] bob's relay address = " + relayAddressBob.address + ':' + relayAddressBob.port)
        // create permission for alice to send messages to bob
        return socketBob.createPermissionP(relayAddressAlice.address)
      })
      .then(function () {
        // create channel from alice to bob
        return socketAlice.bindChannelP(relayAddressBob.address, relayAddressBob.port)
      })
      .then(function (channel) {
        expect(channel).not.to.be.undefined
        channelId = channel
        //  create permission for bob to send messages to alice
        return socketAlice.createPermissionP(relayAddressBob.address)
      })
      .then(function () {
        // create channel from bob to alice
        return socketBob.bindChannelP(relayAddressAlice.address, relayAddressAlice.port)
      })
      .then(function (anotherChannel) {
        // send test message
        sendTestMessageFromAliceToBob()
      })
  })
})
