'use strict'

var dgram = require('dgram')
var transports = require('stun-js').transports
var TurnClient = require('../lib/turn_client')

var chai = require('chai')
var chaiAsPromised = require('chai-as-promised')
var expect = chai.expect
chai.use(chaiAsPromised)
chai.should()

if (!process.env.TURN_ADDR) {
  throw new Error('TURN_ADDR undefined -- giving up')
}
if (!process.env.TURN_PORT) {
  throw new Error('TURN_PORT undefined -- giving up')
}
if (!process.env.TURN_USER) {
  throw new Error('TURN_USER undefined -- giving up')
}
if (!process.env.TURN_PASS) {
  throw new Error('TURN_PASS undefined -- giving up')
}

var turnAddr = process.env.TURN_ADDR
var turnPort = parseInt(process.env.TURN_PORT)
var turnUser = process.env.TURN_USER
var turnPwd = process.env.TURN_PASS
var socketPort = 33333

var winston = require('winston-debug')
winston.level = 'debug'

describe('#TURN operations', function () {
  this.timeout(15000)

  it('should execute TURN allocate operation over UDP socket using promises', function (done) {
    var retransmissionTimer
    // send a TURN allocate request and verify the reply
    var sendAllocateRequest = function (client, socket) {
      client.allocateP()
        .then(function (result) {
          // end retransmissionTimer
          clearTimeout(retransmissionTimer)
          // test results
          expect(result).not.to.be.undefined
          expect(result).to.have.property('mappedAddress')
          expect(result.mappedAddress).to.have.property('address')
          expect(result.mappedAddress).to.have.property('port')
          // expect(result.mappedAddress.address).to.equal(testGW)
          expect(result).to.have.property('relayedAddress')
          expect(result.relayedAddress).to.have.property('address')
          expect(result.relayedAddress).to.have.property('port')
          // expect(result.relayedAddress.address).to.equal(turnAddr)
          return client.closeP()
        })
        .then(function () {
          expect(socket.listeners('message').length).to.equal(1)
          expect(socket.listeners('error').length).to.equal(1)
          // close socket
          socket.close(function () {
            done()
          })
        })
        .catch(function (error) {
          done(error)
        })
    }
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
      client.init(function () {
        // retransmission timer -- we're using UDP ...
        retransmissionTimer = setTimeout(function () {
          console.log('resending ALLOCATE request')
          sendAllocateRequest(client, socket)
        }, 5000)
        // allocate request
        sendAllocateRequest(client, socket)
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
      // expect(result.relayedAddress.address).to.equal(turnAddr)
      client.close(
        function () {
          done()
        },
        onError
      )
    }

    client.init(function () {
      client.allocate(onReady, onError)
    })
  })

  it('should execute TURN allocate operation over unspecified UDP socket using promises', function (done) {
    var retransmissionTimer
    // send a TURN allocate request and verify the reply
    var sendAllocateRequest = function (client) {
      client.allocateP()
        .then(function (result) {
          // end retransmissionTimer
          clearTimeout(retransmissionTimer)
          // test results
          expect(result).not.to.be.undefined
          expect(result).to.have.property('mappedAddress')
          expect(result.mappedAddress).to.have.property('address')
          expect(result.mappedAddress).to.have.property('port')
          // expect(result.mappedAddress.address).to.equal(testGW)
          expect(result).to.have.property('relayedAddress')
          expect(result.relayedAddress).to.have.property('address')
          expect(result.relayedAddress).to.have.property('port')
          // expect(result.relayedAddress.address).to.equal(turnAddr)
          return client.closeP()
        })
        .then(function () {
          done()
        })
        .catch(function (error) {
          done(error)
        })
    }
    // create turn client
    var client = new TurnClient(turnAddr, turnPort, turnUser, turnPwd)
    client.init(function () {
      // retransmission timer -- we're using UDP ...
      retransmissionTimer = setTimeout(function () {
        console.log('resending ALLOCATE request')
        sendAllocateRequest(client)
      }, 5000)
      // allocate request
      sendAllocateRequest(client)
    })
  })

  it('should execute TURN allocate followed by refresh over UDP socket using promises', function (done) {
    var lifetime = 3600
    var retransmissionTimer
    // send a TURN allocate request and verify the reply
    var sendAllocateAndRefreshRequest = function (client) {
      client.allocateP()
        .then(function (result) {
          return client.refreshP(lifetime)
        })
        .then(function (duration) {
          // end retransmissionTimer
          clearTimeout(retransmissionTimer)
          // test results
          expect(duration).to.equal(lifetime)
          // close turn client
          return client.closeP()
        })
        .then(function () {
          expect(socket.listeners('message').length).to.equal(1)
          expect(socket.listeners('error').length).to.equal(1)
          done()
        })
        .catch(function (error) {
          done(error)
        })
    }
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
      var client = new TurnClient(turnAddr, turnPort, turnUser, turnPwd)
      client.init(function () {
        // retransmission timer -- we're using UDP ...
        retransmissionTimer = setTimeout(function () {
          console.log('resending ALLOCATE and REFRESH request')
          sendAllocateAndRefreshRequest(client)
        }, 5000)
        sendAllocateAndRefreshRequest(client)
      })
    })
    socket.bind(socketPort)
  })

  it('should execute TURN allocate followed by create permission over TCP socket using promises', function () {
    var transport = new transports.TCP()
    var client = new TurnClient(turnAddr, turnPort, turnUser, turnPwd, transport)
    var turnAddress = '1.2.3.4'
    return client.initP()
      .then(function () {
        return client.allocateP()
      })
      .then(function (result) {
        return client.createPermissionP(turnAddress)
      })
      .then(function () {
        return client.closeP()
      })
  })

  it('should execute TURN allocate followed by two consecutive create permissions (testing permission refresh) over TCP socket using promises', function () {
    var transport = new transports.TCP()
    var client = new TurnClient(turnAddr, turnPort, turnUser, turnPwd, transport)
    var turnAddress = '1.2.3.4'
    return client.initP()
      .then(function () {
        return client.allocateP()
      })
      .then(function (result) {
        return client.createPermissionP(turnAddress)
      })
      .then(function () {
        return client.createPermissionP(turnAddress)
      })
      .then(function () {
        return client.closeP()
      })
  })

  it('should receive messages that are sent via relay server over TCP sockets', function (done) {
    var testData = 'hello there'
    var testRuns = 10
    var messagesReceived = 0

    // alice's client
    var clientAlice = new TurnClient(turnAddr, turnPort, turnUser, turnPwd, new transports.TCP())
    // bob's client
    var clientBob = new TurnClient(turnAddr, turnPort, turnUser, turnPwd, new transports.TCP())
    var srflxAddressAlice, srflxAddressBob, relayAddressAlice, relayAddressBob

    var sendTestMessageFromAliceToBob = function () {
      var bytes = new Buffer(testData)
      clientAlice.sendToRelay(
        bytes,
        relayAddressBob.address,
        relayAddressBob.port,
        function () {
          console.log('message sent to ' + relayAddressBob.address + ':' + relayAddressBob.port)
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
      console.log('receiving test message ' + message)
      messagesReceived++
      if (messagesReceived === testRuns) {
        clientBob.closeP()
          .then(function () {
            return clientAlice.closeP()
          })
          .then(function () {
            done()
          })
          .catch(function (error) {
            done(error)
          })
      } else {
        sendTestMessageFromAliceToBob()
      }
    })

    // init alice and bob + allocate relaying session for alice
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
        // allocate relaying session for bob
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
        // send test message
        sendTestMessageFromAliceToBob()
      })
      .catch(function (error) {
        done(error)
      })
  })

  it('should concurrently receive messages that are sent via relay server over TCP sockets, using multiple clients', function (done) {
    var nbSessions = 10
    var nbSessionEnded = 0

    var runTestSession = function (onDone) {
      var testData = 'hello there'
      var testRuns = 10
      var messagesReceived = 0

      var clientAlice = new TurnClient(turnAddr, turnPort, turnUser, turnPwd, new transports.TCP())
      var clientBob = new TurnClient(turnAddr, turnPort, turnUser, turnPwd, new transports.TCP())
      var srflxAddressAlice, srflxAddressBob, relayAddressAlice, relayAddressBob

      var sendTestMessageFromAliceToBob = function () {
        var bytes = new Buffer(testData)
        clientAlice.sendToRelay(
          bytes,
          relayAddressBob.address,
          relayAddressBob.port,
          function () {
            console.log('message sent to ' + relayAddressBob.address + ':' + relayAddressBob.port)
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
        console.log('receiving test message ' + message)
        messagesReceived++
        if (messagesReceived === testRuns) {
          clientBob.closeP()
            .then(function () {
              return clientAlice.closeP()
            })
            .then(function () {
              onDone()
            })
            .catch(function (error) {
              done(error)
            })
        } else {
          sendTestMessageFromAliceToBob()
        }
      })

      // init alice and bob + allocate relaying session for alice
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
          // allocate relaying session for bob
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
          // send test message
          sendTestMessageFromAliceToBob()
        })
        .catch(function (error) {
          done(error)
        })
    }

    for (var i = 0; i < nbSessions; i++) {
      runTestSession(function () {
        nbSessionEnded++
        if (nbSessionEnded === nbSessions) {
          done()
        }
      })
    }

  })

  it('should execute TURN channel binding and receive messages sent via these channels over TCP sockets using promises', function (done) {
    var testData = 'hello there'
    var testRuns = 10
    var messagesReceived = 0

    // alice's client
    var clientAlice = new TurnClient(turnAddr, turnPort, turnUser, turnPwd, new transports.TCP())
    // bob's client
    var clientBob = new TurnClient(turnAddr, turnPort, turnUser, turnPwd, new transports.TCP())
    var srflxAddressAlice, srflxAddressBob, relayAddressAlice, relayAddressBob
    var channelId

    var sendTestMessageFromAliceToBob = function () {
      var bytes = new Buffer(testData)
      clientAlice.sendToChannel(
        bytes,
        channelId,
        function () {
          console.log('message sent to channel ' + channelId)
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
      console.log('receiving test message ' + message)
      messagesReceived++
      if (messagesReceived === testRuns) {
        clientBob.closeP()
          .then(function () {
            return clientAlice.closeP()
          })
          .then(function () {
            done()
          })
          .catch(function (error) {
            done(error)
          })
      } else {
        sendTestMessageFromAliceToBob()
      }
    })

    // init alice and bob + allocate relaying session for alice
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
        // allocate relaying session for bob
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
        // create channel from alice to bob
        return clientAlice.bindChannelP(relayAddressBob.address, relayAddressBob.port)
      })
      .then(function (channel) {
        expect(channel).not.to.be.undefined
        channelId = channel
        // mimic refreshing of channel binding
        return clientAlice.bindChannelP(relayAddressBob.address, relayAddressBob.port, channel)
      })
      .then(function (channel) {
        expect(channel).to.equal(channelId)
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
      .catch(function (error) {
        done(error)
      })
  })
})
