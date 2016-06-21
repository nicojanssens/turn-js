[![CircleCI](https://circleci.com/gh/MicroMinion/turn-js.svg?style=svg)](https://circleci.com/gh/MicroMinion/turn-js)

# Turn-JS
#### TURN (Traversal Using Relay NAT) library written entirely in JavaScript.

## Features

- implements (most of) the features specified in [RFC 5766](https://tools.ietf.org/html/rfc5766)
- supports TCP and UDP communication
- offers callback and promise based API

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

### `myClient.createPermission(address, lifetime, function() {}, function(error) {})`

### `myClient.createPermission(address, lifetime)`

### `myClient.bindChannel(address, port, channel, lifetime, function() {}, function(error) {})`

### `myClient.bindChannelP(address, port, channel, lifetime)`

### `myClient.refresh(lifetime, function() {}, function(error) {})`

### `myClient.refreshP(lifetime)`   

### `myClient.close(function() {}, function(error) {})`

### `myClient.sendToRelay(bytes, address, port, function() {}, function(error))`

### `myClient.sendToRelayP(bytes, address, port)`

### `myClient.sendToChannel(bytes, channel, function() {}, function(error) {})`

### `myClient.sendToChannelP(bytes, channel)`


## Events
