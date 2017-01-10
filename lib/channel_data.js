'use strict'

var padding = require('stun-js').padding
var winston = require('winston-debug')
var winstonWrapper = require('winston-meta-wrapper')

var _log = winstonWrapper(winston)
_log.addMeta({
  module: 'turn:channel-data'
})

// channel-data class
var ChannelData = function (channel, bytes) {
  // logging
  this._log = winstonWrapper(winston)
  this._log.addMeta({
    module: 'turn:channel-data'
  })
  // verify channel and bytes
  if (bytes === undefined) {
    var undefinedBytesError = 'invalid channel-data attribute: bytes = undefined'
    this._log.error(undefinedBytesError)
    throw new Error(undefinedBytesError)
  }
  if (channel === undefined) {
    var undefinedChannelError = 'invalid channel-data attribute: channel = undefined'
    this._log.error(undefinedChannelError)
    throw new Error(undefinedChannelError)
  }
  // init
  this.channel = channel
  this.bytes = bytes
  // done
  this._log.debug('channel-data attrs: channel = ' + this.channel + ', length = ' + bytes.length + ' bytes')
}

// packet header length
ChannelData.HEADER_LENGTH = 4

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

ChannelData.decode = function (bytes, isFrame) {
  // check if packet starts with 0b01
  if (!ChannelData._isChannelDataPacket(bytes)) {
    _log.debug('this is not a ChannelData packet')
    return
  }
  // check if buffer contains enough bytes to parse header
  if (bytes.length < ChannelData.HEADER_LENGTH) {
    _log.debug('not enough bytes to parse ChannelData header, giving up')
    return
  }
  // decode channel
  var channelBytes = bytes.slice(0, 2)
  var channel = channelBytes.readUInt16BE(0)
  // check channel number
  if (channel < 0x4000) {
    _log.debug('channel numbers < 0x4000 are reserved and not available for use, since they conflict with the STUN header')
    return
  }
  if (channel > 0x7FFF) {
    _log.debug('channel numbers > 0x7FFF are unassigned')
    return
  }
  // decode data length
  var lengthBytes = bytes.slice(2, ChannelData.HEADER_LENGTH)
  var dataLength = lengthBytes.readUInt16BE(0)
  // check if buffer contains enough bytes to parse channel data
  if (bytes.length < dataLength) {
    _log.debug('not enough bytes to parse channel data, giving up')
    return
  }
  // get data bytes
  var dataBytes = bytes.slice(ChannelData.HEADER_LENGTH, ChannelData.HEADER_LENGTH + dataLength)
  // get padding bytes if this is not a frame (i.e. bytes originate from TCP connection) -- and if present, then silently discard them
  var packetLength = ChannelData.HEADER_LENGTH + dataLength + ((4 - dataLength % 4) % 4) // header + data + padding to the nearest multiple of 4
  if (!isFrame && bytes.length < packetLength) {
    _log.debug('not enough bytes to parse channel data padding bytes, giving up')
    return
  }
  var paddingBytes = bytes.slice(ChannelData.HEADER_LENGTH + dataLength, packetLength) // padding bytes, if any, are silently discarded
  // generate result
  var result = {}
  result.packet = new ChannelData(channel, dataBytes)
  result.remainingBytes = bytes.slice(packetLength, bytes.length)
  // do we expect remaining bytes?
  if (isFrame && result.remainingBytes.length !== 0) {
    var errorMsg = 'not expecting remaining bytes after processing full frame packet'
    _log.error(errorMsg)
    throw new Error(errorMsg)
  }
  // done
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
