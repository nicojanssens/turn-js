'use strict'

var padding = require('stun-js').padding

var debug = require('debug')
var debugLog = debug('turn-js')
var errorLog = debug('turn-js:error')

// channel-data class
var ChannelData = function (channel, bytes) {
  if (bytes === undefined) {
    var undefinedBytesError = 'invalid channel-data attribute: bytes = undefined'
    errorLog(undefinedBytesError)
    throw new Error(undefinedBytesError)
  }
  if (channel === undefined) {
    var undefinedChannelError = 'invalid channel-data attribute: channel = undefined'
    errorLog(undefinedChannelError)
    throw new Error(undefinedChannelError)
  }
  this.channel = channel
  this.bytes = bytes

  debugLog('channel-data attrs: channel = ' + this.channel + ', data = ' + this.bytes)
}

// see RFC 5766, sct 11.5
ChannelData.prototype.encode = function () {
  // create channel bytes
  var channelBytes = new Buffer(2)
  channelBytes.writeUInt16BE(this.channel, 0)
  // create data bytes
  var dataBytes = this.bytes
  // create length bytes
  var lengthBytes = new Buffer(2)
  lengthBytes.writeUInt16BE(dataBytes.length)
  // padding
  var paddingBytes = padding.getBytes(dataBytes.length)
  // glue everything together
  var message = Buffer.concat([channelBytes, lengthBytes, dataBytes, paddingBytes])
  return message
}

ChannelData.decode = function (buffer) {
  if (!ChannelData._isChannelDataPacket(buffer)) {
    return
  }
  // decode channel
  var channelBytes = buffer.slice(0, 2)
  var channel = channelBytes.readUInt16BE()
  // decode data length
  var lengthBytes = buffer.slice(2, 4)
  var length = lengthBytes.readUInt16BE()
  // get data bytes
  var dataBytes = buffer.slice(4, 4 + length)
  // return ChannelData object
  var channelData = new ChannelData(channel, dataBytes)
  return channelData
}

// check if this is a channel data packet (starts with 0b01)
ChannelData._isChannelDataPacket = function (buffer) {
  var block = buffer.readUInt8(0)
  var bit1 = containsFlag(block, 0x80)
  var bit2 = containsFlag(block, 0x40)
  return (!bit1 && bit2)
}

function containsFlag (number, flag) {
  return (number & flag) === flag
}

module.exports = ChannelData
