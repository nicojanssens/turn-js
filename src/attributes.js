'use strict'

var stun = require('stun-js')

// STUN attributes
var Attributes = stun.Attributes

// RFC 5766 (TURN) attributes
Attributes.ChannelNumber = require('./attributes/channel-number')
Attributes.Data = require('./attributes/data')
Attributes.DontFragment = require('./attributes/dont-fragment')
Attributes.EvenPort = require('./attributes/even-port')
Attributes.Lifetime = require('./attributes/lifetime')
Attributes.RequestedTransport = require('./attributes/requested-transport')
Attributes.ReservationToken = require('./attributes/reservation-token')
Attributes.XORPeerAddress = require('./attributes/xor-peer-address')
Attributes.XORRelayedAddress = require('./attributes/xor-relayed-address')

// RFC 5766 (TURN)
Attributes.CHANNEL_NUMBER = 0x000C
Attributes.DATA = 0x0013
Attributes.DONT_FRAGMENT = 0x001A
Attributes.EVEN_PORT = 0x0018
Attributes.LIFETIME = 0x000D
Attributes.REQUESTED_TRANSPORT = 0x0019
Attributes.RESERVATION_TOKEN = 0x0022
Attributes.XOR_PEER_ADDRESS = 0x0012
Attributes.XOR_RELAYED_ADDRESS = 0x0016

// RFC 5766 (TURN)
Attributes.TYPES[Attributes.CHANNEL_NUMBER] = Attributes.ChannelNumber
Attributes.TYPES[Attributes.LIFETIME] = Attributes.Lifetime
Attributes.TYPES[Attributes.XOR_PEER_ADDRESS] = Attributes.XORPeerAddress
Attributes.TYPES[Attributes.DATA] = Attributes.Data
Attributes.TYPES[Attributes.XOR_RELAYED_ADDRESS] = Attributes.XORRelayedAddress
Attributes.TYPES[Attributes.EVEN_PORT] = Attributes.EvenPort
Attributes.TYPES[Attributes.REQUESTED_TRANSPORT] = Attributes.RequestedTransport
Attributes.TYPES[Attributes.DONT_FRAGMENT] = Attributes.DontFragment
Attributes.TYPES[Attributes.RESERVATION_TOKEN] = Attributes.ReservationToken

module.exports = Attributes
