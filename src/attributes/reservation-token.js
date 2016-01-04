'use strict'

var winston = require('winston')

var ReservationTokenAttr = function (token) {
  if (token === undefined || Buffer.byteLength(token) !== 8) {
    var error = '[turn-js] invalid reservation token attribute'
    winston.error(error)
    throw new Error('error')
  }
  this.token = token
  this.type = 0x0022
  winston.debug('[turn-js] reservation token attr: ' + this.token)
}

ReservationTokenAttr.prototype.encode = function () {
  // type
  var typeBytes = new Buffer(2)
  typeBytes.writeUInt16BE(this.type, 0)
  // value
  var valueBytes = new Buffer(this.token)
  if (valueBytes.length !== 8) {
    throw new Error('[turn-js] invalid reservation token attribute')
  }
  // length
  var lengthBytes = new Buffer(2)
  lengthBytes.writeUInt16BE(valueBytes.length, 0)
  // combination
  var result = Buffer.concat([typeBytes, lengthBytes, valueBytes])
  // done
  return result
}

ReservationTokenAttr.decode = function (attrBytes) {
  if (attrBytes.length !== 8) {
    throw new Error('[turn-js] invalid reservation-token attribute')
  }
  var token = attrBytes.toString()
  return new ReservationTokenAttr(token)
}

module.exports = ReservationTokenAttr
