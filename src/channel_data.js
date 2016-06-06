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

  debugLog('channel-data attrs: channel = ' + this.channel)
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

ChannelData.decode = function (bytes) {
  // check if packet starts with 0b01
  if (!ChannelData._isChannelDataPacket(bytes)) {
    debugLog('this is not a ChannelData packet')
    return
  }
  // decode channel
  var channelBytes = bytes.slice(0, 2)
  var channel = channelBytes.readUInt16BE()
  // check channel number
  if (channel < 0x4000) {
    debugLog('channel numbers < 0x4000 are reserved and not available for use, since they conflict with the STUN header')
    return
  }
  if (channel > 0x7FFF) {
    debugLog('channel numbers > 0x7FFF are unassigned')
    return
  }
  // decode data length
  var lengthBytes = bytes.slice(2, 4)
  var dataLength = lengthBytes.readUInt16BE()
  var packetLength = 4 + dataLength + (4 - dataLength % 4) // header + data + padding to the nearest multiple of 4
  // check if buffer contains enough bytes to parse entire channel data frame
  if (bytes.length < packetLength) {
    debugLog('not enough bytes to parse channel data, giving up')
    return
  }
  // get data bytes
  var dataBytes = bytes.slice(4, 4 + dataLength)
  // return ChannelData object
  var packet = new ChannelData(channel, dataBytes)
  var remainingBytes = bytes.slice(packetLength, bytes.length) // padding bytes are dropped
  var result = {
    packet: packet,
    remainingBytes: remainingBytes
  }
  return result
}

// check if this is a channel data packet (starts with 0b01)
ChannelData._isChannelDataPacket = function (bytes) {
  var block = bytes.readUInt8(0)
  var bit1 = containsFlag(block, 0x80)
  var bit2 = containsFlag(block, 0x40)
  return (!bit1 && bit2)
}

function containsFlag (number, flag) {
  return (number & flag) === flag
}

module.exports = ChannelData
