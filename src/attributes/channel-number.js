'use strict'

var debug = require('debug')
var debugLog = debug('turn-js:attributes')
var errorLog = debug('turn-js:attributes:error')

var ChannelNumberAttr = function (channel) {
  if (typeof channel === 'undefined') {
    var channelUndefinedError = 'channel-number attribute undefined'
    errorLog(channelUndefinedError)
    throw new Error(channelUndefinedError)
  }
  if (Number(channel) === 'NaN') {
    var channelNaNError = 'invalid channel-number attribute'
    errorLog(channelNaNError)
    throw new Error(channelNaNError)
  }
  this.channel = channel
  this.type = 0x000C

  debugLog('channel-number = ' + this.channel)
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
