var StunSession = require('../src/stun_session')
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
winston.level = argv.log

describe('#STUN operations', function () {
  this.timeout(5000)

  it('should execute STUN bind operation (using promises)', function () {
    var session = new StunSession(testAddr, testPort)
    return session.listenP()
      .then(function (localAddress) {
        return session.bindP()
      })
      .then(function (mappedAddress) {
        expect(mappedAddress).not.to.be.undefined
        expect(mappedAddress).to.have.property('address')
        expect(mappedAddress).to.have.property('port')
        //expect(mappedAddress.address).to.equal(testGW)
      })
  })

  it('should execute STUN bind operation (using callbacks)', function (done) {
    var session = new StunSession(testAddr, testPort)
    // if something fails
    var onError = function (error) {
      done(error)
    }
    // once some test results are available
    var onReady = function (mappedAddress) {
      expect(mappedAddress).not.to.be.undefined
      expect(mappedAddress).to.have.property('address')
      expect(mappedAddress).to.have.property('port')
      //expect(mappedAddress.address).to.equal(testGW)
      session.close()
      done()
    }
    // if socket is listening
    var onListening = function (localAddress) {
      session.bind(onReady, onError)
    }
    session.listen({},
      onListening, // on ready
      onError // on error
    )
  })

  it('should receive messages that are sent to a srflx address', function (done) {
    var testData = 'hello there'
    var testRuns = 1
    var messagesReceived = 0

    var sessionAlice = new StunSession(testAddr, testPort)
    var sessionBob = new StunSession(testAddr, testPort)
    var addressAlice, addressBob

    // subscribe to incoming messages
    sessionBob.on('message', function (msg, rinfo) {
      expect(msg.toString()).to.equal(testData)
      winston.debug('[libturn] receiving test message ' + msg)
      messagesReceived++
      if (messagesReceived === testRuns) {
        sessionBob.close()
        done()
      }
    })

    // open alice's socket and bind her public address to alice's session (not really needed for this test, but it also doesn't hurt ...)
    sessionAlice.listenP()
      .then(function (localAddress) {
        return sessionAlice.bindP()
      })
      .then(function (mappedAddress) {
        addressAlice = mappedAddress
        winston.debug("[libturn] alice's srflx address = " + addressAlice.address + ':' + addressAlice.port)
        // open bob's socket
        return sessionBob.listenP()
      })
      .then(function (localAddress) {
        // bind public address to bob's session
        return sessionBob.bindP()
      })
      .then(function (mappedAddress) {
        addressBob = mappedAddress
        winston.debug("[libturn] bob's srflx address = " + addressBob.address + ':' + addressBob.port)
        // send test message n times
        for (var i = 0; i < testRuns; i++) {
          sessionAlice.sendData(testData, addressBob.address, addressBob.port, function (error) {
            if (error) {
              done(error)
            }
            winston.debug('[libturn] test message sent to ' + addressBob.address + ':' + addressBob.port)
          })
        }
      })
  })

  // it('should travers NAT using UDP hole punching', function (done) {
  //   var testData = 'hello there'
  //   var testRuns = 1
  //   var messagesReceived = 0
  //
  //   var sessionAlice = new StunSession(testAddr, testPort)
  //   var sessionBob = new StunSession(testAddr, testPort)
  //   var addressAlice, addressBob
  //
  //   // subscribe to incoming messages
  //   sessionBob.on('message', function (msg, rinfo) {
  //     expect(msg.toString()).to.equal(testData)
  //     winston.debug('[libturn] bob receives test message ' + msg)
  //   // done()
  //   })
  //
  //   // subscribe to incoming messages
  //   sessionAlice.on('message', function (msg, rinfo) {
  //     expect(msg.toString()).to.equal(testData)
  //     winston.debug('[libturn] alice receives test message ' + msg)
  //   // done()
  //   })
  //
  //   // open alice's socket and bind her public address to alice's session (not really needed for this test, but it also doesn't hurt ...)
  //   sessionAlice.listenP()
  //     .then(function (localAddress) {
  //       return sessionAlice.bindP()
  //     })
  //     .then(function (mappedAddress) {
  //       addressAlice = mappedAddress
  //       winston.debug("[libturn] alice's srflx address = " + addressAlice.address + ':' + addressAlice.port)
  //       // open bob's socket
  //       return sessionBob.listenP()
  //     })
  //     .then(function (localAddress) {
  //       // bind public address to bob's session
  //       return sessionBob.bindP()
  //     })
  //     .then(function (mappedAddress) {
  //       addressBob = mappedAddress
  //       winston.debug("[libturn] bob's srflx address = " + addressBob.address + ':' + addressBob.port)
  //       // send test message n times
  //       sessionAlice.sendData(testData, addressBob.address, addressBob.port, function (error) {
  //         if (error) {
  //           done(error)
  //         }
  //         winston.debug('[libturn] test message sent to ' + addressBob.address + ':' + addressBob.port)
  //         sessionBob.sendData(testData, addressAlice.address, addressAlice.port, function (error) {
  //           if (error) {
  //             done(error)
  //           }
  //           winston.debug('[libturn] test message sent to ' + addressAlice.address + ':' + addressAlice.port)
  //         })
  //       })
  //     })
  // })

})
