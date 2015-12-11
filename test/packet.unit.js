var Attributes = require('../src/attributes')
var Packet = require('../src/packet')
var winston = require('winston')

var chai = require('chai')
var expect = chai.expect

winston.level = 'debug'

var username = 'foo'
var software = 'libturn-test v0.1'
var lifetime = 3600

describe('#STUN operations', function () {
  it('should encode and decode a binding request', function (done) {
    var packet = new Packet(Packet.METHOD.BINDING | Packet.CLASS.REQUEST)
    var data = packet.encode()
    var decodedPacket = Packet.decode(data)
    expect(decodedPacket.method).to.equal(Packet.METHOD.BINDING | Packet.CLASS.REQUEST)
    done()
  })

  it('should encode and decode a binding indication', function (done) {
    var packet = new Packet(Packet.METHOD.BINDING | Packet.CLASS.INDICATION)
    var data = packet.encode()
    var decodedPacket = Packet.decode(data)
    expect(decodedPacket.method).to.equal(Packet.METHOD.BINDING | Packet.CLASS.INDICATION)
    done()
  })
})

describe('#TURN operations', function () {
  it('should encode and decode an unauthenticated allocation packet', function (done) {
    // create new packet
    var attrs = new Attributes()
    attrs.add(new Attributes.Username(username))
    attrs.add(new Attributes.Software(software))
    attrs.add(new Attributes.Lifetime(lifetime))
    attrs.add(new Attributes.RequestedTransport())
    attrs.add(new Attributes.DontFragment())
    var packet = new Packet(Packet.METHOD.ALLOCATE, attrs)
    // encode test packet
    var data = packet.encode()
    // decode test packet
    var decodedPacket = Packet.decode(data)
    // verify method
    expect(decodedPacket.method).to.equal(Packet.METHOD.ALLOCATE)
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
    var packet = new Packet(Packet.METHOD.CREATEPERMISSION, attrs)
    // encode test packet
    var data = packet.encode()
    // decode test packet
    var decodedPacket = Packet.decode(data)
    // verify method
    expect(decodedPacket.method).to.equal(Packet.METHOD.CREATEPERMISSION)
    // verify attributes
    expect(decodedPacket.getAttribute(Attributes.USERNAME)).not.to.be.undefined
    expect(decodedPacket.getAttribute(Attributes.USERNAME).name).to.equal(username)
    expect(decodedPacket.getAttribute(Attributes.XOR_PEER_ADDRESS)).not.to.be.undefined
    // all good
    done()
  })
})
