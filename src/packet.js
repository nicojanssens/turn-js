var Attributes = require('./attributes')

// packet class
var Packet = function (method, attrs) {
  this.method = method
  this.attrs = attrs || new Attributes()
  this.tid = this._getTransactionId()
}

// packet header length
Packet.HEADER_LENGTH = 20
// STUN magic cookie
Packet.MAGIC_COOKIE = 0x2112A442 // fixed
// max transaction ID (32bit)
Packet.TID_MAX = Math.pow(2, 32)
// message classes
Packet.CLASS = {
  REQUEST: 0x0000,
  INDICATION: 0x0010,
  SUCCESS_RESPONSE: 0x0100,
  ERROR_RESPONSE: 0x0110
}
// STUN method
Packet.METHOD = {
  // RFC 5389 (STUN)
  BINDING: 0x0001,
  // RFC 5766 (TURN)
  ALLOCATE: 0x003,
  REFRESH: 0x004,
  SEND: 0x006,
  DATA: 0x007,
  CREATEPERMISSION: 0x008,
  CHANNELBIND: 0x009
}

// encode packet
Packet.prototype.encode = function () {
  var attrsBuffer = this.attrs.encode(Packet.MAGIC_COOKIE, this.tid)
  var attrsLength = attrsBuffer.length
  // check if we need to include a message integrity attribute
  var messageIntegrity = this.getAttribute(Attributes.MESSAGE_INTEGRITY)
  if (messageIntegrity) {
    attrsLength += 24 // size of the message-integrity attribute
  }
  // encode header buffer
  var headerBuffer = this._encodeHeader(attrsLength)
  // create packet buffer
  var packetBuffer = Buffer.concat([headerBuffer, attrsBuffer])
  // append message integrity attribute if requested
  if (messageIntegrity) {
    var messageIntegrityBuffer = messageIntegrity.encode(packetBuffer)
    packetBuffer = Buffer.concat([packetBuffer, messageIntegrityBuffer])
  }
  return packetBuffer
}

// decode packet
Packet.decode = function (buffer) {
  if (!Packet._isStunPacket(buffer)) {
    return
  }

  var headerBytes = buffer.slice(0, Packet.HEADER_LENGTH)
  var header = Packet._decodeHeader(headerBytes)

  var attrsBytes = buffer.slice(Packet.HEADER_LENGTH, buffer.length)
  var attrs = Attributes.decode(attrsBytes, headerBytes)

  var packet = new Packet(header.method, attrs)
  packet.tid = header.tid

  return packet
}

// get attribute
Packet.prototype.getAttribute = function (type) {
  return this.attrs.get(type)
}

// encode packet header
Packet.prototype._encodeHeader = function (length) {
  var type = this.method
  var encodedHeader = new Buffer(Packet.HEADER_LENGTH)
  encodedHeader.writeUInt16BE((type & 0x3fff), 0)
  encodedHeader.writeUInt16BE(length, 2)
  encodedHeader.writeUInt32BE(Packet.MAGIC_COOKIE, 4)
  encodedHeader.writeUInt32BE(0, 8)
  encodedHeader.writeUInt32BE(0, 12)
  encodedHeader.writeUInt32BE(this.tid, 16)

  return encodedHeader
}

// decode packet header
Packet._decodeHeader = function (buffer) {
  var header = {}
  header.method = buffer.readUInt16BE(0)
  header.length = buffer.readUInt16BE(2)
  header.magic_cookie = buffer.readUInt32BE(4)
  header.tid = buffer.readUInt32BE(16)

  return header
}

// check if this is a STUN packet (starts with 0b00)
Packet._isStunPacket = function (buffer) {
  var block = buffer.readUInt8(0)
  var bit1 = containsFlag(block, 0x80)
  var bit2 = containsFlag(block, 0x40)
  return (!bit1 && !bit2)
}

// generate tansaction ID
Packet.prototype._getTransactionId = function () {
  return (Math.random() * Packet.TID_MAX)
}

function containsFlag (number, flag) {
  return (number & flag) === flag
}

module.exports = Packet
