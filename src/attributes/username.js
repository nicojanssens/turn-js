var padding = require('./padding')
var winston = require('winston')

var UsernameAttr = function (name) {
  if (name === undefined) {
    var error = '[libturn] invalid username attribute'
    winston.error(error)
    throw new Error(error)
  }
  this.name = name
  this.type = 0x0006
  winston.debug('[libturn] username attr: ' + this.name)
}

UsernameAttr.prototype.encode = function () {
  // type
  var typeBytes = new Buffer(2)
  typeBytes.writeUInt16BE(this.type, 0)
  // value
  var valueBytes = new Buffer(this.name)
  if (valueBytes.length > 512) {
    throw new Error('[libturn] invalid username attribute')
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

UsernameAttr.decode = function (attrBytes) {
  if (attrBytes.length > 512) {
    throw new Error('[libturn] invalid username')
  }
  var name = attrBytes.toString()
  return new UsernameAttr(name)
}

module.exports = UsernameAttr
