'use strict'

var winston = require('winston-debug')
var winstonWrapper = require('winston-meta-wrapper')

var ReservationTokenAttr = function (token) {
  // logging
  this._log = winstonWrapper(winston)
  this._log.addMeta({
    module: 'turn:attributes'
  })
  // verify token
  if (token === undefined || Buffer.byteLength(token) !== 8) {
    var errorMsg = 'invalid reservation token attribute'
    this._log.error(errorMsg)
    throw new Error('error')
  }
  // init
  this.token = token
  this.type = 0x0022
  // done
  this._log.debug('reservation token attr: ' + this.token)
}

ReservationTokenAttr.prototype.encode = function () {
  // type
  var typeBytes = new Buffer(2)
  typeBytes.writeUInt16BE(this.type, 0)
  // value
  var valueBytes = new Buffer(this.token)
  if (valueBytes.length !== 8) {
    throw new Error('invalid reservation token attribute')
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
    throw new Error('invalid reservation-token attribute')
  }
  var token = attrBytes.toString()
  return new ReservationTokenAttr(token)
}

module.exports = ReservationTokenAttr
