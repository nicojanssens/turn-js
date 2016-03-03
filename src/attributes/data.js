'use strict'

var padding = require('stun-js').padding

var debug = require('debug')
var debugLog = debug('turn-js:attributes')
var errorLog = debug('turn-js:attributes:error')

var DataAttr = function (bytes) {
  if (bytes === undefined) {
    var error = 'invalid bytes attribute'
    errorLog(error)
    throw new Error(error)
  }
  this.bytes = bytes
  this.type = 0x0013
  debugLog('data attr: ' + this.bytes)
}

DataAttr.prototype.encode = function () {
  // type
  var typeBytes = new Buffer(2)
  typeBytes.writeUInt16BE(this.type, 0)
  // value
  var valueBytes = this.bytes
  // length
  var lengthBytes = new Buffer(2)
  lengthBytes.writeUInt16BE(valueBytes.length, 0)
  // padding
  var paddingBytes = padding.getBytes(valueBytes.length)
  // combination
  var result = Buffer.concat([typeBytes, lengthBytes, valueBytes, paddingBytes])
  // done
  return result
}

DataAttr.decode = function (attrBytes) {
  return new DataAttr(attrBytes)
}

module.exports = DataAttr
