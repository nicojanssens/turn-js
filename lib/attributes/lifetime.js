'use strict'

var winston = require('winston-debug')
var winstonWrapper = require('winston-meta-wrapper')

var LifetimeAttr = function (duration) {
  // logging
  this._log = winstonWrapper(winston)
  this._log.addMeta({
    module: 'turn:attributes'
  })
  // verify duration
  if (typeof duration !== 'number') {
    var errorMsg = 'invalid lifetime attribute'
    this._log.error(errorMsg)
    throw new Error(errorMsg)
  }
  // init
  this.duration = duration
  this.type = 0x000D
  // done
  this._log.debug('lifetime attr: ' + this.duration)
}

LifetimeAttr.prototype.encode = function () {
  // type
  var typeBytes = new Buffer(2)
  typeBytes.writeUInt16BE(this.type, 0)
  // value
  var valueBytes = new Buffer(4)
  valueBytes.writeUInt32BE(this.duration, 0)
  // length
  var lengthBytes = new Buffer(2)
  lengthBytes.writeUInt16BE(valueBytes.length, 0)
  // combination
  var result = Buffer.concat([typeBytes, lengthBytes, valueBytes])
  // done
  return result
}

LifetimeAttr.decode = function (attrBytes) {
  if (attrBytes.length !== 4) {
    throw new Error('invalid lifetime attribute')
  }
  var duration = attrBytes.readUInt32BE(0)
  return new LifetimeAttr(duration)
}

module.exports = LifetimeAttr
