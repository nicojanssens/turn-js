var padding = require('./padding')
var winston = require('winston')

var DataAttr = function (data) {
  if (data === undefined) {
    var error = '[libturn] invalid data attribute'
    winston.error(error)
    throw new Error(error)
  }
  this.data = data
  this.type = 0x0013
  winston.debug('[libturn] data attr: ' + this.data)
}

DataAttr.prototype.encode = function () {
  // type
  var typeBytes = new Buffer(2)
  typeBytes.writeUInt16BE(this.type, 0)
  // value
  var valueBytes = new Buffer(this.data)
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
  var data = attrBytes.toString()
  return new DataAttr(data)
}

module.exports = DataAttr
