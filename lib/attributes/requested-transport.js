'use strict'

var winston = require('winston-debug')
var winstonWrapper = require('winston-meta-wrapper')

var RequestedTransportAttr = function () {
  // logging
  this._log = winstonWrapper(winston)
  this._log.addMeta({
    module: 'turn:attributes'
  })
  // init
  this.value = 17 // UDP only
  this.type = 0x0019
  // done
  this._log.debug('requested transport attr: ' + this.value)
}

RequestedTransportAttr.prototype.encode = function () {
  // type
  var typeBytes = new Buffer(2)
  typeBytes.writeUInt16BE(this.type, 0)
  // value
  var valueBytes = new Buffer(4)
  valueBytes.writeUIntBE(this.value, 0, 1)
  for (var i = 1; i <= 3; i++) { // RFFU bytes
    valueBytes.writeUIntBE(0, i, 1)
  }
  // length
  var lengthBytes = new Buffer(2)
  lengthBytes.writeUInt16BE(valueBytes.length, 0)
  // combination
  var result = Buffer.concat([typeBytes, lengthBytes, valueBytes])
  // done
  return result
}

RequestedTransportAttr.decode = function (attrBytes) {
  if (attrBytes.length !== 4) {
    throw new Error('invalid requested transport attribute')
  }
  var value = attrBytes.readUInt32BE(0)
  return new RequestedTransportAttr(value)
}

module.exports = RequestedTransportAttr
