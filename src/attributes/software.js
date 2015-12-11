var padding = require('./padding')
var winston = require('winston')

var SoftwareAttr = function (description) {
  if (description === undefined) {
    var error = '[libturn] invalid software attribute'
    winston.error(error)
    throw new Error(error)
  }
  this.description = description
  this.type = 0x8022
  winston.debug('[libturn] software attr: ' + this.description)
}

SoftwareAttr.prototype.encode = function () {
  // type
  var typeBytes = new Buffer(2)
  typeBytes.writeUInt16BE(this.type, 0)
  // value
  var valueBytes = new Buffer(this.description)
  if (this.description.length >= 128 || valueBytes.length >= 764) {
    throw new Error('[libturn] invalid software attribute')
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

SoftwareAttr.decode = function (attrBytes) {
  var description = attrBytes.toString()
  if (attrBytes.length >= 764 || description.length >= 128) {
    throw new Error('[libturn] invalid software attribute')
  }
  return new SoftwareAttr(description)
}

module.exports = SoftwareAttr
