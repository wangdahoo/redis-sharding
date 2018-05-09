# redis-sharding
> simple redis sharding based on [Redis](https://www.npmjs.com/package/redis) and [HashRing](https://www.npmjs.com/package/hashring)

### How to Use

```bash
$ npm i redis-sharding
```

* client

```js
const Sharding = require('redis-sharding')

const sharding = new Sharding({
  '127.0.0.1:7000': { vnodes: 50 },
  '127.0.0.1:7001': { vnodes: 50 },
  '127.0.0.1:7002': { vnodes: 50 },
  '127.0.0.1:7003': { vnodes: 50 }
})

const client = sharding.getClient()
client
  .set('foo', 'bar')
  .then(server => console.log(server)) // => 127.0.0.1:7001
  .then(() => client.get('foo'))
  .then(value => console.log(value)) // => bar
```

* multi

```js
const Sharding = require('redis-sharding')

const sharding = new Sharding({
  '127.0.0.1:7000': { vnodes: 50 },
  '127.0.0.1:7001': { vnodes: 50 },
  '127.0.0.1:7002': { vnodes: 50 },
  '127.0.0.1:7003': { vnodes: 50 }
})

const multi = sharding.getMulti()
await multi.set('a', 'foo')
await multi.set('b', 'bar')
await multi.get('a')
await multi.get('b')
const replies = await multi.execAsync()
console.log(replies) // => [127.0.0.1:7002, 127.0.0.1:7000, 'foo', 'bar']
```
