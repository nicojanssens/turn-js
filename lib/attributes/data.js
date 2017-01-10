'use strict'

var padding = require('stun-js').padding
var winston = require('winston-debug')
var winstonWrapper = require('winston-meta-wrapper')

var DataAttr = function (bytes) {
  // logging
  this._log = winstonWrapper(winston)
  this._log.addMeta({
    module: 'turn:attributes'
  })
  // verifying bytes
  if (bytes === undefined) {
    var errorMsg = 'invalid bytes attribute'
    this._log.error(errorMsg)
    throw new Error(errorMsg)
  }
  // init
  this.bytes = bytes
  this.type = 0x0013
  // done
  this._log.debug('data attr: ' + this.bytes)
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
