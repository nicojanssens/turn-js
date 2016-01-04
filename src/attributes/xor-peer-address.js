'use strict'

var addressAttr = require('stun-js').address
var winston = require('winston')

var XORPeerAddressAttr = function (address, port) {
  if (address === undefined) {
    var error = '[turn-js] invalid xor peer address attribute'
    winston.error(error)
    throw new Error(error)
  }
  this.address = address
  this.port = port || 0
  this.type = 0x0012

  winston.debug('[turn-js] xor peer address attr: ' + this.address + ':' + this.port)
}

XORPeerAddressAttr.prototype.encode = function (magic, tid) {
  if (magic === undefined || tid === undefined) {
    var error = '[turn-js] invalid xorPeerAddressAttr.encode params'
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

XORPeerAddressAttr.decode = function (attrBytes, headerBytes) {
  var magicBytes = headerBytes.slice(4, 8) // BE
  var tidBytes = headerBytes.slice(8, 20) // BE

  var result = addressAttr.decodeXor(attrBytes, magicBytes, tidBytes)
  return new XORPeerAddressAttr(result.address, result.port)
}

module.exports = XORPeerAddressAttr
