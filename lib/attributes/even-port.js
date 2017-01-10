'use strict'

var padding = require('stun-js').padding
var winston = require('winston-debug')
var winstonWrapper = require('winston-meta-wrapper')

var EvenPortAttr = function (reserveNextHigherPortNumber) {
  // logging
  this._log = winstonWrapper(winston)
  this._log.addMeta({
    module: 'turn:attributes'
  })
  // verify reserveNextHigherPortNumber
  if (typeof reserveNextHigherPortNumber !== 'boolean') {
    var errorMsg = 'invalid even port attribute'
    this._log.error(errorMsg)
    throw new Error(errorMsg)
  }
  // init
  this.reserveNextHigherPortNumber = reserveNextHigherPortNumber
  this.type = 0x0018
  // done
  this._log.debug('even port attr w reserve-next-higher-port-number bit set to ' + this.reserveNextHigherPortNumber)
}

EvenPortAttr.prototype.encode = function () {
  // type
  var typeBytes = new Buffer(2)
  typeBytes.writeUInt16BE(this.type, 0)
  // value
  var valueBytes = new Buffer(1)
  this.reserveNextHigherPortNumber ? valueBytes.writeUInt8(0x80) : valueBytes.writeUInt8(0x00)
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

EvenPortAttr.decode = function (attrBytes) {
  var reserveNextHigherPortNumber = (attrBytes.readUInt8(0) === 0x80) // other bytes are 0
  return new EvenPortAttr(reserveNextHigherPortNumber)
}

module.exports = EvenPortAttr
