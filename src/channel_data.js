'use strict'

var winston = require('winston')

// channel-data class
var ChannelData = function (channel, bytes) {
  if (bytes === undefined) {
    var undefinedBytesError = '[turn-js] invalid channel-data attribute: bytes = undefined'
    winston.error(undefinedBytesError)
    throw new Error(undefinedBytesError)
  }
  if (channel === undefined) {
    var undefinedChannelError = '[turn-js] invalid channel-data attribute: channel = undefined'
    winston.error(undefinedChannelError)
    throw new Error(undefinedChannelError)
  }
  this.channel = channel
  this.bytes = bytes

  winston.debug('[turn-js] channel-data attrs: channel = ' + this.channel + ', data = ' + this.bytes)
}

ChannelData.prototype.encode = function () {
  // create channel bytes
  var channelBytes = new Buffer(2)
  channelBytes.writeUInt16BE(this.channel, 0)
  // create data bytes
  var dataBytes = this.bytes
  // create length bytes
  var lengthBytes = new Buffer(2)
  lengthBytes.writeUInt16BE(dataBytes.length)
  // glue everything together
  var message = Buffer.concat([channelBytes, lengthBytes, dataBytes])
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
