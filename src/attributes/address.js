exports.encode = encode
exports.encodeXor = encodeXor
exports.decode = decode
exports.decodeXor = decodeXor

var ip = require('ip')
var winston = require('winston')

var IPv4 = 0x01
var IPv6 = 0x02

function encode (address, port) {
  // checks
  if (address === undefined || port === undefined) {
    var attrError = '[libturn] invalid address attribute'
    winston.error(attrError)
    throw new Error(attrError)
  }
  if (!ip.isV4Format(address) && !ip.isV6Format(address)) {
    var hostError = '[libturn] invalid address host'
    winston.error(hostError)
    throw new Error(hostError)
  }
  if (port < 0 || port > 65536) {
    var portError = '[libturn] invalid address port'
    winston.error(portError)
    throw new Error(portError)
  }
  // create family type
  var familyByte = new Buffer(1)
  ip.isV4Format(address) ? familyByte.writeUInt8(IPv4) : familyByte.writeUInt8(IPv6)
  // create address bytes
  var addressBytes = ip.toBuffer(address)
  // create null byte
  var nullByte = new Buffer(1)
  nullByte.writeUInt8(0, 0)
  // create port bytes
  var portBytes = new Buffer(2)
  portBytes.writeUInt16BE(port, 0)
  // concat
  return Buffer.concat([nullByte, familyByte, portBytes, addressBytes])
}

function encodeXor (address, port, magic, tid) {
  // checks
  if (address === undefined || port === undefined) {
    var attrError = '[libturn] invalid address attribute'
    winston.error(attrError)
    throw new Error(attrError)
  }
  if (!ip.isV4Format(address) && !ip.isV6Format(address)) {
    var hostError = '[libturn] invalid address host'
    winston.error(hostError)
    throw new Error(hostError)
  }
  if (port < 0 || port > 65536) {
    var portError = '[libturn] invalid address port'
    winston.error(portError)
    throw new Error(portError)
  }
  if (magic === undefined || tid === undefined) {
    var keyError = '[libturn] invalid xor keys'
    winston.error(keyError)
    throw new Error(keyError)
  }
  // magic and tid bytes -- needed for xor mapping
  var magicBytes = new Buffer(4)
  magicBytes.writeUInt32BE(magic)
  var tidBytes = new Buffer(12)
  tidBytes.writeUInt32BE(0)
  tidBytes.writeUInt32BE(0, 4)
  tidBytes.writeUInt32BE(tid, 8)
  // create family type
  var familyByte = new Buffer(1)
  ip.isV4Format(address) ? familyByte.writeUInt8(IPv4) : familyByte.writeUInt8(IPv6)
  // create xaddress bytes
  var addressBytes = ip.toBuffer(address)
  var xaddressBytes = xor(addressBytes, ip.isV4Format(address) ? magicBytes : Buffer.concat([magicBytes, tidBytes]))
  // create null byte
  var nullByte = new Buffer(1)
  nullByte.writeUInt8(0, 0)
  // create xport bytes
  var portBytes = new Buffer(2)
  portBytes.writeUInt16BE(port, 0)
  var xportBytes = xor(portBytes, magicBytes.slice(0, 2))
  // concat
  return Buffer.concat([nullByte, familyByte, xportBytes, xaddressBytes])
}

function decode (bytes) {
  var family = (bytes.readUInt8(1) === IPv4) ? 4 : 6
  var portBytes = bytes.slice(2, 4) // LE
  var addressBytes = bytes.slice(4, family === 4 ? 8 : 20) // LE
  var result = {
    family: family,
    port: portBytes.readUInt16BE(),
    address: ip.toString(addressBytes, 0, family)
  }
  return result
}

function decodeXor (bytes, magicBytes, tidBytes) {
  var family = (bytes.readUInt8(1) === IPv4) ? 4 : 6
  var xportBytes = bytes.slice(2, 4) // LE
  var portBytes = xor(xportBytes, magicBytes.slice(0, 2))
  var xaddressBytes = bytes.slice(4, family === 4 ? 8 : 20) // LE
  var addressBytes = xor(xaddressBytes, family === 4 ? magicBytes : Buffer.concat([magicBytes, tidBytes]))
  var result = {
    family: family,
    port: portBytes.readUInt16BE(),
    address: ip.toString(addressBytes, 0, family)
  }
  return result
}

function xor (a, b) {
  var data = []

  if (b.length > a.length) {
    var tmp = a
    a = b
    b = tmp
  }

  for (var i = 0, len = a.length; i < len; i++) {
    data.push(a[i] ^ b[i])
  }

  return new Buffer(data)
}
