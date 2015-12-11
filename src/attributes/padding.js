exports.getBytes = getBytes

var PADDING_VALUE = '0'

function getBytes (length) {
  var paddingBytes = new Buffer((4 - length % 4) % 4)
  paddingBytes.fill(PADDING_VALUE)
  return paddingBytes
}
