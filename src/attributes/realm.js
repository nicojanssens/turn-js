var padding = require('./padding')
var winston = require('winston')

var RealmAttr = function (value) {
  if (value === undefined || value === '') {
    var error = '[libturn] invalid realm attribute'
    winston.error(error)
    throw new Error(error)
  }
  this.value = value
  this.type = 0x0014
  winston.debug('[libturn] realm attr: ' + this.value)
}

RealmAttr.prototype.encode = function () {
  // type
  var typeBytes = new Buffer(2)
  typeBytes.writeUInt16BE(this.type, 0)
  // value
  var valueBytes = new Buffer(this.value)
  if (this.value.length >= 128 || valueBytes.length >= 764) {
    throw new Error('[libturn] invalid realm attribute')
  }
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

RealmAttr.decode = function (attrBytes) {
  var value = attrBytes.toString()
  if (attrBytes.length >= 764 || value.length >= 128) {
    throw new Error('[libturn] invalid realm attribute')
  }
  return new RealmAttr(value)
}

module.exports = RealmAttr
