[![CircleCI](https://circleci.com/gh/MicroMinion/turn-js.svg?style=shield)](https://circleci.com/gh/MicroMinion/turn-js)
[![npm](https://img.shields.io/npm/v/turn-js.svg)](https://npmjs.org/package/turn-js)

# Turn-JS
#### TURN (Traversal Using Relay NAT) library written entirely in JavaScript.

## Features

- implements (most of) the features specified in [RFC 5766](https://tools.ietf.org/html/rfc5766)
- supports TCP and UDP communication
- offers callback and promise based API
- can be browserified (to be used in chrome apps)

## Install

```
npm install turn-js
```

## Usage

### Callbacks

### Promises

## API

### `myClient = turn(serverAddr, serverPort, user, pwd, transport)`

### `myClient.allocate(function(address) {}, function(error) {})`

### `myClient.allocateP()`

### `myClient.createPermission(address, function() {}, function(error) {})`

### `myClient.createPermission(address)`

### `myClient.bindChannel(address, port, channel, lifetime, function() {}, function(error) {})`

### `myClient.bindChannelP(address, port, channel)`

### `myClient.refresh(lifetime, function() {}, function(error) {})`

### `myClient.refreshP(lifetime)`   

### `myClient.close(function() {}, function(error) {})`

### `myClient.sendToRelay(bytes, address, port, function() {}, function(error))`

### `myClient.sendToRelayP(bytes, address, port)`

### `myClient.sendToChannel(bytes, channel, function() {}, function(error) {})`

### `myClient.sendToChannelP(bytes, channel)`


## Events
