'use strict'

var Attributes = require('./src/attributes')
var ChannelData = require('./src/channel_data')
var Packet = require('./src/packet')
var TurnSocket = require('./src/turn_socket')

module.exports = function createSocket (address, port, user, pwd, udpSocket) {
  return new TurnSocket(address, port, user, pwd, udpSocket)
}

// TURN components
module.exports.Attributes = Attributes
module.exports.ChannelData = ChannelData
module.exports.Packet = Packet
module.exports.TurnSocket = TurnSocket
