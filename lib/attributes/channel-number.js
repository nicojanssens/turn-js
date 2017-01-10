'use strict'

var winston = require('winston-debug')
var winstonWrapper = require('winston-meta-wrapper')

var ChannelNumberAttr = function (channel) {
  // logging
  this._log = winstonWrapper(winston)
  this._log.addMeta({
    module: 'turn:attributes'
  })
  // verifying channel
  if (typeof channel === 'undefined') {
    var channelUndefinedError = 'channel-number attribute undefined'
    this._log.error(channelUndefinedError)
    throw new Error(channelUndefinedError)
  }
  if (Number(channel) === 'NaN') {
    var channelNaNError = 'invalid channel-number attribute'
    this._log.error(channelNaNError)
    throw new Error(channelNaNError)
  }
  // init
  this.channel = channel
  this.type = 0x000C
  // done
  this._log.debug('channel-number = ' + this.channel)
}

ChannelNumberAttr.prototype.encode = function () {
  // type
  var typeBytes = new Buffer(2)
  typeBytes.writeUInt16BE(this.type, 0)
  // value
  var valueBytes = new Buffer(4)
  valueBytes.writeUInt16BE(this.channel)
  valueBytes.writeUInt16BE(0, 2) // reserved for future use
  // length
  var lengthBytes = new Buffer(2)
  lengthBytes.writeUInt16BE(valueBytes.length, 0)
  // combination
  var result = Buffer.concat([typeBytes, lengthBytes, valueBytes])
  // done
  return result
}

ChannelNumberAttr.decode = function (attrBytes) {
  if (attrBytes.length !== 4) {
    throw new Error('invalid channel-number attribute')
  }
  var channel = attrBytes.readUInt16BE(0) // only two bytes are used
  return new ChannelNumberAttr(channel)
}

module.exports = ChannelNumberAttr
