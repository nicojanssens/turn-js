'use strict'

var Attributes = require('./src/attributes')
var ChannelData = require('./src/channel_data')
var Packet = require('./src/packet')
var TurnClient = require('./src/turn_client')

module.exports = function createClient (address, port, user, pwd, udpSocket) {
  return new TurnClient(address, port, user, pwd, udpSocket)
}

// TURN components
module.exports.Attributes = Attributes
module.exports.ChannelData = ChannelData
module.exports.Packet = Packet
module.exports.TurnClient = TurnClient
