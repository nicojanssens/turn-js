'use strict'

var Attributes = require('../lib/attributes')
var Packet = require('../lib/packet')

var chai = require('chai')
var expect = chai.expect

describe('#TURN attributes', function () {
  it('should encode and decode a channel-number attribute', function (done) {
    var testChannel = 0x4001
    var ChannelNumber = Attributes.ChannelNumber
    var channelNumber = new ChannelNumber(testChannel)
    var bytes = channelNumber.encode()
    var decodedChannelNumber = ChannelNumber.decode(bytes.slice(4, bytes.lenght))
    expect(decodedChannelNumber.channel).to.exist
    expect(decodedChannelNumber.channel).to.equal(testChannel)
    done()
  })

  it('should encode and decode a lifetime attribute', function (done) {
    var testDuration = 3600
    var Lifetime = Attributes.Lifetime
    var lifetime = new Lifetime(testDuration)
    var bytes = lifetime.encode()
    var decodedLifetime = Lifetime.decode(bytes.slice(4, bytes.lenght))
    expect(decodedLifetime.duration).to.exist
    expect(decodedLifetime.duration).to.equal(testDuration)
    done()
  })

  it('should encode and decode an xor-peer-address attribute', function (done) {
    var testAddress = '127.0.0.1'
    var testPort = 2345
    var tid = Math.random() * Packet.TID_MAX
    var magic = Packet.MAGIC_COOKIE
    var testHeaderBytes = createTestHeaderBytes(magic, tid)
    var XORPeerAddress = Attributes.XORPeerAddress
    var xorPeerAddress = new XORPeerAddress(testAddress, testPort)
    var bytes = xorPeerAddress.encode(magic, tid)
    var decodedXORPeerAddress = XORPeerAddress.decode(bytes.slice(4, bytes.lenght), testHeaderBytes)
    expect(decodedXORPeerAddress.address).to.exist
    expect(decodedXORPeerAddress.address).to.equal(testAddress)
    expect(decodedXORPeerAddress.port).to.exist
    expect(decodedXORPeerAddress.port).to.equal(testPort)
    done()
  })

  it('should encode and decode a data attribute', function (done) {
    var testData = 'this is such an awesome library'
    var testBytes = new Buffer(testData)
    var Data = Attributes.Data
    var data = new Data(testBytes)
    var bytes = data.encode()
    var length = bytes.readUInt16BE(2)
    var decodedData = Data.decode(bytes.slice(4, 4 + length))
    expect(decodedData.bytes).to.exist
    expect(decodedData.bytes.toString()).to.equal(testData)
    done()
  })

  it('should encode and decode an xor-relayed-address attribute', function (done) {
    var testAddress = '127.0.0.1'
    var testPort = 2345
    var tid = Math.random() * Packet.TID_MAX
    var magic = Packet.MAGIC_COOKIE
    var testHeaderBytes = createTestHeaderBytes(magic, tid)
    var XORRelayedAddress = Attributes.XORRelayedAddress
    var xorRelayedAddress = new XORRelayedAddress(testAddress, testPort)
    var bytes = xorRelayedAddress.encode(magic, tid)
    var decodedXORRelayedAddress = XORRelayedAddress.decode(bytes.slice(4, bytes.lenght), testHeaderBytes)
    expect(decodedXORRelayedAddress.address).to.exist
    expect(decodedXORRelayedAddress.address).to.equal(testAddress)
    expect(decodedXORRelayedAddress.port).to.exist
    expect(decodedXORRelayedAddress.port).to.equal(testPort)
    done()
  })

  it('should encode and decode an even port attribute', function (done) {
    var reserveNextHigherPortNumber = true
    var EvenPort = Attributes.EvenPort
    var evenPort = new EvenPort(reserveNextHigherPortNumber)
    var bytes = evenPort.encode()
    var decodedEvenPort = EvenPort.decode(bytes.slice(4, bytes.lenght))
    expect(decodedEvenPort.reserveNextHigherPortNumber).to.exist
    expect(decodedEvenPort.reserveNextHigherPortNumber).to.equal(reserveNextHigherPortNumber)
    done()
  })

  it('should encode and decode a requested-transport attribute', function (done) {
    var RequestedTransport = Attributes.RequestedTransport
    var requestedTransport = new RequestedTransport()
    var bytes = requestedTransport.encode()
    var decodedRequestedTransport = RequestedTransport.decode(bytes.slice(4, bytes.lenght))
    expect(decodedRequestedTransport.value).to.exist
    expect(decodedRequestedTransport.value).to.equal(17)
    done()
  })

  it("should encode and decode a don't fragment attribute", function (done) {
    var DontFragment = Attributes.DontFragment
    var dontFragment = new DontFragment()
    var bytes = dontFragment.encode()
    var decodedDontFragment = DontFragment.decode(bytes.slice(4, bytes.lenght))
    expect(decodedDontFragment).to.exist
    done()
  })

  it('should encode and decode a reservation-token attribute', function (done) {
    var testToken = 'abcdefgh'
    var ReservationToken = Attributes.ReservationToken
    var reservationToken = new ReservationToken(testToken)
    var bytes = reservationToken.encode()
    var decodedReservationToken = ReservationToken.decode(bytes.slice(4, bytes.lenght))
    expect(decodedReservationToken.token).to.exist
    expect(decodedReservationToken.token).to.equal(testToken)
    done()
  })
})

function createTestHeaderBytes (magic, tid) {
  var encodedHeader = new Buffer(Packet.HEADER_LENGTH)
  var type = Packet.METHOD.ALLOCATE | Packet.TYPE.REQUEST
  var length = 0
  encodedHeader.writeUInt16BE((type & 0x3fff), 0)
  encodedHeader.writeUInt16BE(length, 2)
  encodedHeader.writeUInt32BE(magic, 4)
  encodedHeader.writeUInt32BE(0, 8)
  encodedHeader.writeUInt32BE(0, 12)
  encodedHeader.writeUInt32BE(tid, 16)
  return encodedHeader
}
