'use strict'

var addressAttr = require('stun-js').address
var winston = require('winston')

var XORRelayedAddressAttr = function (address, port) {
  if (address === undefined || port === undefined) {
    var error = '[turn-js] invalid xor relayed address attribute'
    winston.error(error)
    throw new Error(error)
  }
  this.address = address
  this.port = port
  this.type = 0x0016

  winston.debug('[turn-js] xor relayed address attr: ' + this.address + ':' + this.port)
}

XORRelayedAddressAttr.prototype.encode = function (magic, tid) {
  if (magic === undefined || tid === undefined) {
    var error = '[turn-js] invalid xorRelayedAddressAttr.encode params'
    winston.error(error)
    throw new Error(error)
  }
  // type
  var typeBytes = new Buffer(2)
  typeBytes.writeUInt16BE(this.type, 0)
  // value
  var valueBytes = addressAttr.encodeXor(this.address, this.port, magic, tid)
  // length
  var lengthBytes = new Buffer(2)
  lengthBytes.writeUInt16BE(valueBytes.length, 0)
  // combination
  var result = Buffer.concat([typeBytes, lengthBytes, valueBytes])
  // done
  return result
}

XORRelayedAddressAttr.decode = function (attrBytes, headerBytes) {
  var magicBytes = headerBytes.slice(4, 8) // BE
  var tidBytes = headerBytes.slice(8, 20) // BE

  var result = addressAttr.decodeXor(attrBytes, magicBytes, tidBytes)
  return new XORRelayedAddressAttr(result.address, result.port)
}

module.exports = XORRelayedAddressAttr
