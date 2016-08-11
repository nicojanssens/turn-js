'use strict'

var Attributes = require('../lib/attributes')
var Packet = require('../lib/packet')

var chai = require('chai')
var expect = chai.expect

var username = 'foo'
var software = 'turn-js-test'
var lifetime = 3600

describe('#TURN operations', function () {
  it('should encode and decode an unauthenticated allocation packet', function (done) {
    // create new packet
    var attrs = new Attributes()
    attrs.add(new Attributes.Username(username))
    attrs.add(new Attributes.Software(software))
    attrs.add(new Attributes.Lifetime(lifetime))
    attrs.add(new Attributes.RequestedTransport())
    attrs.add(new Attributes.DontFragment())
    var packet = new Packet(Packet.METHOD.ALLOCATE, Packet.TYPE.REQUEST, attrs)
    // encode test packet
    var data = packet.encode()
    // decode test packet
    var turnDecoding = Packet.decode(data)
    var decodedPacket = turnDecoding.packet
    // verify method
    expect(decodedPacket.method).to.equal(Packet.METHOD.ALLOCATE)
    expect(decodedPacket.type).to.equal(Packet.TYPE.REQUEST)
    // verify attributes
    expect(decodedPacket.getAttribute(Attributes.USERNAME)).not.to.be.undefined
    expect(decodedPacket.getAttribute(Attributes.USERNAME).name).to.equal(username)
    expect(decodedPacket.getAttribute(Attributes.SOFTWARE)).not.to.be.undefined
    expect(decodedPacket.getAttribute(Attributes.SOFTWARE).description).to.equal(software)
    expect(decodedPacket.getAttribute(Attributes.LIFETIME)).not.to.be.undefined
    expect(decodedPacket.getAttribute(Attributes.LIFETIME).duration).to.equal(lifetime)
    expect(decodedPacket.getAttribute(Attributes.REQUESTED_TRANSPORT)).not.to.be.undefined
    expect(decodedPacket.getAttribute(Attributes.REQUESTED_TRANSPORT).value).to.equal(17)
    expect(decodedPacket.getAttribute(Attributes.DONT_FRAGMENT)).not.to.be.undefined
    // check remaining bytes
    var remainingBytes = turnDecoding.remainingBytes
    expect(remainingBytes.length).to.equal(0)
    // all good
    done()
  })

  it('should encode and decode an authenticated allocation packet', function (done) {
    // TODO
    done()
  })

  it('should encode and decode an unauthenticated createPermission packet', function (done) {
    var address = '192.168.99.1'
    // create new packet
    var attrs = new Attributes()
    attrs.add(new Attributes.Username(username))
    attrs.add(new Attributes.XORPeerAddress(address))
    var packet = new Packet(Packet.METHOD.CREATEPERMISSION, Packet.TYPE.INDICATION, attrs)
    // encode test packet
    var data = packet.encode()
    // decode test packet
    var turnDecoding = Packet.decode(data)
    var decodedPacket = turnDecoding.packet
    // verify method
    expect(decodedPacket.method).to.equal(Packet.METHOD.CREATEPERMISSION)
    expect(decodedPacket.type).to.equal(Packet.TYPE.INDICATION)
    // verify attributes
    expect(decodedPacket.getAttribute(Attributes.USERNAME)).not.to.be.undefined
    expect(decodedPacket.getAttribute(Attributes.USERNAME).name).to.equal(username)
    expect(decodedPacket.getAttribute(Attributes.XOR_PEER_ADDRESS)).not.to.be.undefined
    // check remaining bytes
    var remainingBytes = turnDecoding.remainingBytes
    expect(remainingBytes.length).to.equal(0)
    // all good
    done()
  })
})
