var winston = require('winston')

// channel-data class
var ChannelData = function (channel, data) {
  if (data === undefined) {
    var undefinedDataError = '[libturn] invalid channel-data attribute: data = undefined'
    winston.error(undefinedDataError)
    throw new Error(undefinedDataError)
  }
  if (channel === undefined) {
    var undefinedChannelError = '[libturn] invalid channel-data attribute: channel = undefined'
    winston.error(undefinedChannelError)
    throw new Error(undefinedChannelError)
  }
  this.channel = channel
  this.data = data

  winston.debug('[libturn] channel-data attrs: channel = ' + this.channel + ', data = ' + this.data)
}

ChannelData.prototype.encode = function () {
  // create channel bytes
  var channelBytes = new Buffer(2)
  channelBytes.writeUInt16BE(this.channel, 0)
  // create data bytes
  var dataBytes = new Buffer(this.data)
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
  // decod data
  var dataBytes = buffer.slice(4, 4 + length)
  var data = dataBytes.toString()

  var channelData = new ChannelData(channel, data)
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
