var dgram = require('dgram')
var events = require('events')
var util = require('util')
var Q = require('q')
var winston = require('winston')

var Attributes = require('./attributes')
var ChannelData = require('./channel_data')
var Packet = require('./packet')

// Init session object
var Session = function (stunHost, stunPort) {
  if (stunPort === undefined || stunHost === undefined) {
    var error = '[libturn] invalid session params'
    winston.error(error)
    throw new Error(error)
  }
  this._stunPort = stunPort
  this._stunHost = stunHost

  events.EventEmitter.call(this)

  var socket = dgram.createSocket('udp4')
  this._socket = socket
  socket.on('message', this._onMessage())
  socket.on('error', this._onError())
}

// Inherit EventEmitter
util.inherits(Session, events.EventEmitter)

// Open socket
Session.prototype.listen = function (args, onReady, onError) {
  args = args | {}
  if (onReady === undefined || onError === undefined) {
    var error = '[libturn] listen callback handlers are undefined'
    winston.error(error)
    throw new Error(error)
  }
  this.listenP(args)
    .then(function (result) {
      onReady(result)
    })
    .catch(function (error) {
      onError(error)
    })
}

Session.prototype.listenP = function (args) {
  var deferred = Q.defer()
  args = args | {}
  var self = this
  this._socket.bind(args.address, args.port, function () {
    var listeningAddress = self._socket.address()
    winston.debug('[libturn] socket listening ' + listeningAddress.address + ':' + listeningAddress.port)
    deferred.resolve(listeningAddress)
  })
  return deferred.promise
}

// Close socket
Session.prototype._close = function () {
  this._socket.close()
}

/** UDP communication */

// Send UDP message
Session.prototype._sendStunMessage = function (message, cb) {
  this._socket.send(message, 0, message.length, this._stunPort, this._stunHost, cb)
}

// Send STUN UDP message as a promise
Session.prototype._sendStunMessageP = function (message) {
  var deferred = Q.defer()
  this._onStunReply = function (stunPacket) {
    deferred.resolve(stunPacket)
  }
  this._socket.send(message, 0, message.length, this._stunPort, this._stunHost)
  return deferred.promise
}

// Datagram incoming message handler
Session.prototype._onMessage = function () {
  var self = this

  return function _onMessage (msg, rinfo) {
    winston.debug('[libturn] receiving message from ' + JSON.stringify(rinfo))
    var stunPacket = Packet.decode(msg)
    if (stunPacket) {
      // if this is a data indication
      if (stunPacket.method === (Packet.METHOD.DATA | Packet.CLASS.INDICATION)) {
        var data = stunPacket.getAttribute(Attributes.DATA).data
        var xorPeerAddress = stunPacket.getAttribute(Attributes.XOR_PEER_ADDRESS)
        self.emit('data', data, {
          address: xorPeerAddress.address,
          port: xorPeerAddress.port
        })
        return
      }
      // this is a normal stun reply
      self._onStunReply(stunPacket)
      return
    }
    var channelData = ChannelData.decode(msg)
    // if this is a channel-data message
    if (channelData) {
      var data = channelData.data
      self.emit('data', data, {
        address: rinfo.address,
        port: rinfo.port
      })
      return
    }
    // this is not a stun packet
    self.emit('message', msg, rinfo)
  }
}

// Datagram error handler
Session.prototype._onError = function () {
  return function _onError (error) {
    var errorMsg = '[libturn] socket error: ' + error
    winston.error(errorMsg)
    throw new Error(errorMsg)
  }
}

module.exports = Session
