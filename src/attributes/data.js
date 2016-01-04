'use strict'

var padding = require('stun-js').padding
var winston = require('winston')

var DataAttr = function (bytes) {
  if (bytes === undefined) {
    var error = '[turn-js] invalid bytes attribute'
    winston.error(error)
    throw new Error(error)
  }
  this.bytes = bytes
  this.type = 0x0013
  winston.debug('[turn-js] data attr: ' + this.bytes)
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
