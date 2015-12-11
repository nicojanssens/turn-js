var inherits = require('util').inherits
var Q = require('q')
var winston = require('winston')

var Attributes = require('./attributes')
var Packet = require('./packet')
var Session = require('./session')

// Constructor
var StunSession = function (stunHost, stunPort) {
  Session.call(this, stunHost, stunPort)
}

// Inherit from session
inherits(StunSession, Session)

/** Session operations */

// Bind request
StunSession.prototype.bindP = function () {
  return this.sendBindRequestP()
    .then(function (bindReply) {
      var errorCode = bindReply.getAttribute(Attributes.ERROR_CODE)
      // check if the reply includes an error code attr
      if (errorCode) {
        throw new Error('[libturn] bind error: ' + errorCode.reason)
      }
      var mappedAddressAttr = bindReply.getAttribute(Attributes.XOR_MAPPED_ADDRESS)
      if (!mappedAddressAttr) {
        mappedAddressAttr = bindReply.getAttribute(Attributes.MAPPED_ADDRESS)
      }
      var mappedAddress = {
        address: mappedAddressAttr.address,
        port: mappedAddressAttr.port
      }
      return Q.fcall(function () {
        return mappedAddress
      })
    })
}

StunSession.prototype.bind = function (onReady, onError) {
  if (onReady === undefined || onError === undefined) {
    var error = '[libturn] bind callback handlers are undefined'
    winston.error(error)
    throw new Error(error)
  }
  this.bindP()
    .then(function (result) {
      onReady(result)
    })
    .catch(function (error) {
      onError(error)
    })
}

// Close this session
StunSession.prototype.close = function (onReady, onError) {
  this._close()
}

/** Message transmission */

// Send STUN bind
StunSession.prototype.sendBindRequest = function (cb) {
  winston.debug('[libturn] send bind')
  var message = _composeBindRequestMessage()
  this._sendStunMessage(message, cb)
}

StunSession.prototype.sendBindRequestP = function () {
  winston.debug('[libturn] send bind')
  var message = _composeBindRequestMessage()
  return this._sendStunMessageP(message)
}

// Send data to server reflexive address
StunSession.prototype.sendData = function (data, host, port, cb) {
  var message = new Buffer(data)
  this._socket.send(message, 0, message.length, port, host, cb)
}

/** Message composition */

// Create bind request message
function _composeBindRequestMessage () {
  // create packet
  var packet = new Packet(Packet.METHOD.BINDING | Packet.CLASS.REQUEST)
  // encode packet
  var message = packet.encode()
  return message
}

module.exports = StunSession
