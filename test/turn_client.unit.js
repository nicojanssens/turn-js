'use strict'

var dgram = require('dgram')
var transports = require('stun-js').transports
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

var turnAddr = argv.addr
var turnPort = argv.port
var turnUser = argv.user
var turnPwd = argv.pwd
var socketPort = 12345
winston.level = argv.log

describe('#TURN operations', function () {
  this.timeout(5000)

  it('should execute TURN allocate operation over UDP socket using promises', function () {
    // create socket
    var socket = dgram.createSocket('udp4')
    socket.on('message', function (message, rinfo) { //
      done(new Error('message callback should not be fired'))
    })
    socket.on('error', function (error) {
      done(error)
    })
    socket.on('listening', function () {
      // create turn client and pass socket over
      var transport = new transports.UDP(socket)
      var client = new TurnClient(turnAddr, turnPort, turnUser, turnPwd, transport)
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
          expect(result.relayedAddress.address).to.equal(turnAddr)
          return client.closeP()
        })
        .then(function () {
          expect(socket.listeners('message').length).to.equal(1)
          expect(socket.listeners('error').length).to.equal(1)
        })
    })
    socket.bind(socketPort)
  })

  it('should execute TURN allocate operation over TCP socket using callbacks', function (done) {
    var transport = new transports.TCP()
    var client = new TurnClient(turnAddr, turnPort, turnUser, turnPwd, transport)

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
      expect(result.relayedAddress.address).to.equal(turnAddr)
      client.close(
        function () {
          done()
        },
        onError
      )
    }

    client.allocate(onReady, onError)
  })

  it('should execute TURN allocate operation over unspecified UDP socket using promises', function () {
    var client = new TurnClient(turnAddr, turnPort, turnUser, turnPwd)
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
        expect(result.relayedAddress.address).to.equal(turnAddr)
        return client.closeP()
      })
  })

  it('should execute TURN allocate followed by refresh over UDP socket using promises', function () {
    // create socket
    var socket = dgram.createSocket('udp4')
    socket.on('message', function (message, rinfo) { //
      done(new Error('message callback should not be fired'))
    })
    socket.on('error', function (error) {
      done(error)
    })
    socket.on('listening', function () {
      // create stun client and pass socket over
      var transport = new transports.UDP(socket)
      var client = new TurnClient(turnAddr, turnPort, turnUser, turnPwd, transport)
      var lifetime = 600
      return client.allocateP()
        .then(function (result) {
          return client.refreshP(lifetime)
        })
        .then(function (duration) {
          expect(duration).to.equal(lifetime)
          return client.closeP()
        })
        .then(function () {
          expect(socket.listeners('message').length).to.equal(1)
          expect(socket.listeners('error').length).to.equal(1)
        })
    })
    socket.bind(socketPort)
  })

  it('should execute TURN allocate followed by create permission over TCP socket using promises', function () {
    var transport = new transports.TCP()
    var client = new TurnClient(turnAddr, turnPort, turnUser, turnPwd, transport)
    var turnAddress = '1.2.3.4'
    var lifetime = 600
    return client.allocateP()
      .then(function (result) {
        return client.createPermissionP(turnAddress, lifetime)
      })
      .then(function () {
        return client.closeP()
      })
  })

  it('should receive messages that are sent via relay server over TCP and UDP socket', function (done) {
    var testData = 'hello there'
    var testRuns = 10
    var messagesReceived = 0

    // alice's client uses UDP socket
    var clientAlice = new TurnClient(turnAddr, turnPort, turnUser, turnPwd)
    // bob's client uses TCP socket
    var transportBob = new transports.TCP()
    var clientBob = new TurnClient(turnAddr, turnPort, turnUser, turnPwd, transportBob)
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

  it('should execute TURN channel binding and receive messages sent via these channels over TCP and UDP socket using promises', function (done) {
    var testData = 'hello there'
    var testRuns = 10
    var messagesReceived = 0

    // alice's client uses TCP socket
    var transportAlice = new transports.TCP()
    var clientAlice = new TurnClient(turnAddr, turnPort, turnUser, turnPwd, transportAlice)
    // bob's client uses UDP socket
    var transportBob = new transports.TCP()
    var clientBob = new TurnClient(turnAddr, turnPort, turnUser, turnPwd)
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
