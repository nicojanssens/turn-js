'use strict'

var debug = require('debug')
var debugLog = debug('turn-js:attributes')

var DontFragmentAttr = function () {
  this.type = 0x001A
  debugLog("don't fragment attr")
}

DontFragmentAttr.prototype.encode = function () {
  // type
  var typeBytes = new Buffer(2)
  typeBytes.writeUInt16BE(this.type, 0)
  // length
  var lengthBytes = new Buffer(2)
  lengthBytes.writeUInt16BE(0, 0)
  // combination
  var result = Buffer.concat([typeBytes, lengthBytes])
  // done
  return result
}

DontFragmentAttr.decode = function (attrBytes) {
  return new DontFragmentAttr()
}

module.exports = DontFragmentAttr
