var addressAttr = require('./address')
var winston = require('winston')

var MappedAddressAttr = function (address, port) {
  if (address === undefined || port === undefined) {
    var error = '[libturn] invalid mapped address attribute'
    winston.error(error)
    throw new Error('error')
  }
  this.address = address
  this.port = port
  this.type = 0x0001

  winston.debug('[libturn] mapped address = ' + this.address + ', port = ' + this.port)
}

MappedAddressAttr.prototype.encode = function () {
  // type
  var typeBytes = new Buffer(2)
  typeBytes.writeUInt16BE(this.type, 0)
  // value
  var valueBytes = addressAttr.encode(this.address, this.port)
  // length
  var lengthBytes = new Buffer(2)
  lengthBytes.writeUInt16BE(valueBytes.length, 0)
  // combination
  var result = Buffer.concat([typeBytes, lengthBytes, valueBytes])
  // done
  return result
}

MappedAddressAttr.decode = function (attrBytes) {
  var result = addressAttr.decode(attrBytes)
  return new MappedAddressAttr(result.address, result.port)
}

module.exports = MappedAddressAttr
