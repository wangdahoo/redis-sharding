const assert = require('assert')
const Sharding = require('../lib')
const sharding = new Sharding({
  '127.0.0.1:7000': { vnodes: 50 },
  '127.0.0.1:7001': { vnodes: 50 },
  '127.0.0.1:7002': { vnodes: 50 },
  '127.0.0.1:7003': { vnodes: 50 }
})

// client.set or client.setAsync
sharding.defaults = {
  useAsyncSuffix: true
}

const save = (k, v) => {
  let server
  const client = sharding.getClient()
  return client
    .setAsync(k, v)
    .then(_server => {
      server = _server
      return client.getAsync(k)
    })
    .then(value => {
      console.log(`<${k}> saved on node ${server}`)
      return value
    })
}

const str = 'abcdefghijklmnopqrstuvwxyz'
Promise
  .all(str.split('').map(i => save(i, i)))
  .then(result => assert.ok(result.join('') === str, '结果不一致'))
