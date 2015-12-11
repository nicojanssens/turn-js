var winston = require('winston')

// Attributes Class
var Attributes = function () {
  this.attrs = []
}

// RFC 5389 (STUN) attributes
Attributes.AlternateServer = require('./attributes/alternate-server')
Attributes.ErrorCode = require('./attributes/error-code')
Attributes.MappedAddress = require('./attributes/mapped-address')
Attributes.MessageIntegrity = require('./attributes/message-integrity')
Attributes.Nonce = require('./attributes/nonce')
Attributes.Realm = require('./attributes/realm')
Attributes.Software = require('./attributes/software')
Attributes.UnknownAttributes = require('./attributes/unknown-attributes')
Attributes.Username = require('./attributes/username')
Attributes.XORMappedAddress = require('./attributes/xor-mapped-address')
// RFC 5766 (TURN) attributes
Attributes.ChannelNumber = require('./attributes/channel-number')
Attributes.Data = require('./attributes/data')
Attributes.DontFragment = require('./attributes/dont-fragment')
Attributes.EvenPort = require('./attributes/even-port')
Attributes.Lifetime = require('./attributes/lifetime')
Attributes.RequestedTransport = require('./attributes/requested-transport')
Attributes.ReservationToken = require('./attributes/reservation-token')
Attributes.XORPeerAddress = require('./attributes/xor-peer-address')
Attributes.XORRelayedAddress = require('./attributes/xor-relayed-address')

// RFC 5389 (STUN) attributes
Attributes.MAPPED_ADDRESS = 0x0001
Attributes.USERNAME = 0x0006
Attributes.MESSAGE_INTEGRITY = 0x0008
Attributes.ERROR_CODE = 0x0009
Attributes.UNKNOWN_ATTRIBUTES = 0x000A
Attributes.REALM = 0x0014
Attributes.NONCE = 0x0015
Attributes.XOR_MAPPED_ADDRESS = 0x0020
Attributes.SOFTWARE = 0x8022
Attributes.ALTERNATE_SERVER = 0x8023
Attributes.FINGERPRINT = 0x8028
// RFC 5766 (TURN)
Attributes.CHANNEL_NUMBER = 0x000C
Attributes.LIFETIME = 0x000D
Attributes.XOR_PEER_ADDRESS = 0x0012
Attributes.DATA = 0x0013
Attributes.XOR_RELAYED_ADDRESS = 0x0016
Attributes.EVEN_PORT = 0x0018
Attributes.REQUESTED_TRANSPORT = 0x0019
Attributes.DONT_FRAGMENT = 0x001A
Attributes.RESERVATION_TOKEN = 0x0022

Attributes.TYPES = {}
// RFC 5389 (STUN)
Attributes.TYPES[Attributes.MAPPED_ADDRESS] = Attributes.MappedAddress
Attributes.TYPES[Attributes.USERNAME] = Attributes.Username
Attributes.TYPES[Attributes.MESSAGE_INTEGRITY] = Attributes.MessageIntegrity
Attributes.TYPES[Attributes.ERROR_CODE] = Attributes.ErrorCode
Attributes.TYPES[Attributes.UNKNOWN_ATTRIBUTES] = Attributes.UnknownAttributes
Attributes.TYPES[Attributes.REALM] = Attributes.Realm
Attributes.TYPES[Attributes.NONCE] = Attributes.Nonce
Attributes.TYPES[Attributes.XOR_MAPPED_ADDRESS] = Attributes.XORMappedAddress
Attributes.TYPES[Attributes.SOFTWARE] = Attributes.Software
Attributes.TYPES[Attributes.ALTERNATE_SERVER] = Attributes.AlternateServer
// Attributes.TYPES[Attributes.FINGERPRINT] = 'FINGERPRINT'
// RFC 5766 (TURN)
Attributes.TYPES[Attributes.CHANNEL_NUMBER] = Attributes.ChannelNumber
Attributes.TYPES[Attributes.LIFETIME] = Attributes.Lifetime
Attributes.TYPES[Attributes.XOR_PEER_ADDRESS] = Attributes.XORPeerAddress
Attributes.TYPES[Attributes.DATA] = Attributes.Data
Attributes.TYPES[Attributes.XOR_RELAYED_ADDRESS] = Attributes.XORRelayedAddress
Attributes.TYPES[Attributes.EVEN_PORT] = Attributes.EvenPort
Attributes.TYPES[Attributes.REQUESTED_TRANSPORT] = Attributes.RequestedTransport
Attributes.TYPES[Attributes.DONT_FRAGMENT] = Attributes.DontFragment
Attributes.TYPES[Attributes.RESERVATION_TOKEN] = Attributes.ReservationToken

Attributes.prototype.add = function (attr) {
  if (typeof attr.encode !== 'function') {
    throw new Error('[libturn] attribute ' + attr + ' does not contain required encoding function')
  }
  this.attrs.push(attr)
}

Attributes.prototype.get = function (type) {
  return this.attrs.find(function (attr) {
    return attr.type === type
  })
}

Attributes.prototype.encode = function (magic, tid) {
  var attrBytesArray = []
  this.attrs.forEach(function (attr) {
    // magic & tid must be passed to encode xor encoded addresses
    if ([Attributes.XOR_MAPPED_ADDRESS, Attributes.XOR_RELAYED_ADDRESS, Attributes.XOR_PEER_ADDRESS].indexOf(attr.type) > -1) {
      attrBytesArray.push(attr.encode(magic, tid))
      return
    }
    // message integrity attr requires special treatment -- see packet.encode()
    if (attr.type === Attributes.MESSAGE_INTEGRITY) {
      return
    }
    // all other attributes can be encoded without further ado
    attrBytesArray.push(attr.encode())
  })
  return Buffer.concat(attrBytesArray)
}

Attributes.decode = function (attrsBuffer, headerBuffer) {
  var offset = 0
  var attrs = new Attributes()

  while (offset < attrsBuffer.length) {
    var type = attrsBuffer.readUInt16BE(offset)
    offset += 2

    var length = attrsBuffer.readUInt16BE(offset)
    var blockOut = length % 4
    var padding = blockOut > 0 ? 4 - blockOut : 0
    offset += 2

    var attrBytes = attrsBuffer.slice(offset, offset + length)
    offset += length + padding
    var decoder = Attributes.TYPES[type]
    if (decoder) {
      var attr = decoder.decode(attrBytes, headerBuffer)
      attrs.add(attr)
    } else {
      winston.debug("[libturn] don't know how to process attribute " + type.toString(16) + '. Ignoring ...')
    }
  }

  return attrs
}

module.exports = Attributes
