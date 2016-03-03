'use strict'

var addressAttr = require('stun-js').address

var debug = require('debug')
var debugLog = debug('turn-js:attributes')
var errorLog = debug('turn-js:attributes:error')

var XORPeerAddressAttr = function (address, port) {
  if (address === undefined) {
    var error = 'invalid xor peer address attribute'
    errorLog(error)
    throw new Error(error)
  }
  this.address = address
  this.port = port || 0
  this.type = 0x0012

  debugLog('xor peer address attr: ' + this.address + ':' + this.port)
}

XORPeerAddressAttr.prototype.encode = function (magic, tid) {
  if (magic === undefined || tid === undefined) {
    var error = 'invalid xorPeerAddressAttr.encode params'
    errorLog(error)
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
