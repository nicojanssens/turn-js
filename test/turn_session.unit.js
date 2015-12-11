var TurnSession = require('../src/turn_session')
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
    .choices('l', ['info', 'debug', 'warn', 'error', 'verbose', 'silly' ])
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
    var session = new TurnSession(testAddr, testPort, testUser, testPwd)
    return session.allocateP()
      .then(function (result) {
        expect(result).not.to.be.undefined
        expect(result).to.have.property('mappedAddress')
        expect(result.mappedAddress).to.have.property('address')
        expect(result.mappedAddress).to.have.property('port')
        //expect(result.mappedAddress.address).to.equal(testGW)
        expect(result).to.have.property('relayedAddress')
        expect(result.relayedAddress).to.have.property('address')
        expect(result.relayedAddress).to.have.property('port')
        expect(result.relayedAddress.address).to.equal(testAddr)
        return session.closeP()
      })
  })

  it('should execute TURN allocate operation (using callbacks)', function (done) {
    var session = new TurnSession(testAddr, testPort, testUser, testPwd)

    var onError = function (error) {
      done(error)
    }

    var onReady = function (result) {
      expect(result).not.to.be.undefined
      expect(result).to.have.property('mappedAddress')
      expect(result.mappedAddress).to.have.property('address')
      expect(result.mappedAddress).to.have.property('port')
      //expect(result.mappedAddress.address).to.equal(testGW)
      expect(result).to.have.property('relayedAddress')
      expect(result.relayedAddress).to.have.property('address')
      expect(result.relayedAddress).to.have.property('port')
      expect(result.relayedAddress.address).to.equal(testAddr)
      session.close(
        function () {
          done()
        },
        onError
      )
    }

    session.allocate(onReady, onError)
  })

  it('should execute TURN allocate followed by refresh (using promises)', function () {
    var session = new TurnSession(testAddr, testPort, testUser, testPwd)
    var lifetime = 600
    return session.allocateP()
      .then(function (result) {
        return session.refreshP(lifetime)
      })
      .then(function (duration) {
        expect(duration).to.equal(lifetime)
        return session.closeP()
      })
  })

  it('should execute TURN allocate followed by create permission (using promises)', function () {
    var session = new TurnSession(testAddr, testPort, testUser, testPwd)
    var testAddress = '1.2.3.4'
    var lifetime = 600
    return session.allocateP()
      .then(function (result) {
        return session.createPermissionP(testAddress, lifetime)
      })
      .then(function () {
        return session.closeP()
      })
  })

  it('should receive messages that are sent via relay server', function (done) {
    var testData = 'hello there'
    var testRuns = 10
    var messagesReceived = 0

    var sessionAlice = new TurnSession(testAddr, testPort, testUser, testPwd)
    var sessionBob = new TurnSession(testAddr, testPort, testUser, testPwd)
    var srflxAddressAlice, srflxAddressBob, relayAddressAlice, relayAddressBob

    var sendTestMessageFromAliceToBob = function() {
      sessionAlice.sendData(testData, relayAddressBob.address, relayAddressBob.port, function (error) {
        if (error) {
          done(error)
        }
        winston.debug('[libturn] deliver message to ' + relayAddressBob.address + ':' + relayAddressBob.port)
      })
    }

    // subscribe to incoming messages
    sessionBob.on('data', function (data, peerAddress) {
      expect(data).to.equal(testData)
      winston.debug('[libturn] receiving test message ' + data)
      messagesReceived++
      if (messagesReceived === testRuns) {
        sessionBob.closeP()
          .then(function() {
            return sessionAlice.closeP()
          })
          .then(function() {
            done()
          })
      } else {
        sendTestMessageFromAliceToBob()
      }
    })

    // allocate session alice
    sessionAlice.allocateP()
      .then(function (allocateAddress) {
        srflxAddressAlice = allocateAddress.mappedAddress
        relayAddressAlice = allocateAddress.relayedAddress
        winston.debug('[libturn] alice\'s srflx address = ' + srflxAddressAlice.address + ':' + srflxAddressAlice.port)
        winston.debug('[libturn] alice\'s relay address = ' + relayAddressAlice.address + ':' + relayAddressAlice.port)
        // allocate session bob
        return sessionBob.allocateP()
      })
      .then(function (allocateAddress) {
        srflxAddressBob = allocateAddress.mappedAddress
        relayAddressBob = allocateAddress.relayedAddress
        winston.debug('[libturn] bob\'s address = ' + srflxAddressBob.address + ':' + srflxAddressBob.port)
        winston.debug('[libturn] bob\'s relay address = ' + relayAddressBob.address + ':' + relayAddressBob.port)
        // create permission for alice to send messages to bob
        return sessionBob.createPermissionP(relayAddressAlice.address)
      })
      .then(function () {
        // create permission for bob to send messages to alice
        return sessionAlice.createPermissionP(relayAddressBob.address)
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

    var sessionAlice = new TurnSession(testAddr, testPort, testUser, testPwd)
    var sessionBob = new TurnSession(testAddr, testPort, testUser, testPwd)
    var srflxAddressAlice, srflxAddressBob, relayAddressAlice, relayAddressBob
    var channelId

    var sendTestMessageFromAliceToBob = function () {
      sessionAlice.sendChannelData(channelId, testData, function (error) {
        if (error) {
          done(error)
        }
        winston.debug('[libturn] deliver message to channel ' + channelId)
      })
    }

    // subscribe to incoming messages
    sessionBob.on('data', function (data, peerAddress) {
      expect(data).to.equal(testData)
      winston.debug('[libturn] receiving test message ' + data)
      messagesReceived++
      if (messagesReceived === testRuns) {
        sessionBob.closeP()
          .then(function () {
            return sessionAlice.closeP()
          })
          .then(function () {
            done()
          })
      } else {
        sendTestMessageFromAliceToBob()
      }
    })

    // allocate session alice
    sessionAlice.allocateP()
      .then(function (allocateAddress) {
        srflxAddressAlice = allocateAddress.mappedAddress
        relayAddressAlice = allocateAddress.relayedAddress
        winston.debug("[libturn] alice's srflx address = " + srflxAddressAlice.address + ':' + srflxAddressAlice.port)
        winston.debug("[libturn] alice's relay address = " + relayAddressAlice.address + ':' + relayAddressAlice.port)
        // allocate session bob
        return sessionBob.allocateP()
      })
      .then(function (allocateAddress) {
        srflxAddressBob = allocateAddress.mappedAddress
        relayAddressBob = allocateAddress.relayedAddress
        winston.debug("[libturn] bob's address = " + srflxAddressBob.address + ':' + srflxAddressBob.port)
        winston.debug("[libturn] bob's relay address = " + relayAddressBob.address + ':' + relayAddressBob.port)
        // create permission for alice to send messages to bob
        return sessionBob.createPermissionP(relayAddressAlice.address)
      })
      .then(function () {
        // create channel from alice to bob
        return sessionAlice.bindChannelP(relayAddressBob.address, relayAddressBob.port)
      })
      .then(function (channel) {
        expect(channel).not.to.be.undefined
        channelId = channel
        //  create permission for bob to send messages to alice
        return sessionAlice.createPermissionP(relayAddressBob.address)
      })
      .then(function () {
        // create channel from bob to alice
        return sessionBob.bindChannelP(relayAddressAlice.address, relayAddressAlice.port)
      })
      .then(function (anotherChannel) {
        // send test message
        sendTestMessageFromAliceToBob()
      })
  })
})
