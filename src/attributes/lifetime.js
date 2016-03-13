'use strict'

var debug = require('debug')
var debugLog = debug('turn-js:attributes')
var errorLog = debug('turn-js:attributes:error')

var LifetimeAttr = function (duration) {
  if (typeof duration !== 'number') {
    var error = 'invalid lifetime attribute'
    errorLog(error)
    throw new Error(error)
  }
  this.duration = duration
  this.type = 0x000D

  debugLog('lifetime attr: ' + this.duration)
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
